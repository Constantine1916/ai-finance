import { eq, max } from "drizzle-orm";
import type { Db } from "@/db/types";
import { ingestRuns, observations } from "@/db/schema";
import { getConfig } from "@/lib/config";
import { runIngestJob, type Adapter } from "@/pipeline/ingest";
import { pruneSnapshots, storeSnapshots } from "@/pipeline/intraday";
import { checkIntradayBudget } from "@/pipeline/schedule";
import { upsertSeries } from "@/pipeline/store";
import type { SeriesDef } from "@/pipeline/types";
import { beaAdapter } from "@/sources/bea";
import { blsAdapter } from "@/sources/bls";
import { ALL_SERIES, BEA_SERIES, BLS_SERIES, FRED_SERIES, MARKET_ETFS, TREASURY_SERIES, tiingoSeries } from "@/sources/catalog";
import { activeMembers, ensureDefaultUniverse } from "@/ai/universe";
import { fetchTickerDirectory } from "@/sources/edgar";
import { runEdgar } from "./edgar";
import { runTsmc } from "./tsmc";
import { FINNHUB_LIMIT_PER_MINUTE, fetchQuotes } from "@/sources/finnhub";
import { fredAdapter } from "@/sources/fred";
import { tiingoAdapter } from "@/sources/tiingo";
import { treasuryAdapter } from "@/sources/treasury";
import type { ScheduledJob } from "@/worker/jobs";
import { crossCheckTreasury } from "./cross-check";
import { runDerive } from "./derive";
import { evaluateAll, logStateChanges } from "@/signals/engine";
import { syncCalendar } from "@/calendar/sync";

const NO_KEY = { configured: true as const, credential: "" as const };

const lastObsDate = (db: Db) => async (seriesId: string) => {
  const [row] = await db.select({ d: max(observations.obsDate) }).from(observations).where(eq(observations.seriesId, seriesId));
  return row?.d ?? undefined;
};

function ingest(id: string, series: SeriesDef[], adapter: (db: Db) => Adapter, provider: () => ReturnType<typeof getConfig>["providers"]["fred"] | typeof NO_KEY) {
  return async (db: Db) => {
    const outcome = await runIngestJob(db, { id, adapter: adapter(db), provider: provider(), series });
    console.log(`${id}：${outcome.status}，新增 ${outcome.written.inserted}，修订 ${outcome.written.revised}，待确认 ${outcome.written.pending}`);
    if (outcome.errors.length) console.error(outcome.errors.join("\n"));
  };
}

export const INTRADAY_INTERVAL = 5;

// 日线与盘中快照覆盖大盘 ETF 与当前关注池
async function marketSymbols(db: Db) {
  return [...new Set([...MARKET_ETFS, ...(await activeMembers(db)).map((m) => m.symbol)])];
}

export const checkUniverseBudget = (memberCount: number) => checkIntradayBudget(MARKET_ETFS.length + memberCount, INTRADAY_INTERVAL, FINNHUB_LIMIT_PER_MINUTE);

async function intraday(db: Db) {
  const provider = getConfig().providers.finnhub;
  if (!provider.configured) {
    await db.insert(ingestRuns).values({ job: "finnhub:intraday", status: "skipped", finishedAt: new Date(), error: provider.reason });
    return;
  }
  const symbols = await marketSymbols(db);
  const budget = checkIntradayBudget(symbols.length, INTRADAY_INTERVAL, FINNHUB_LIMIT_PER_MINUTE);
  if (!budget.ok) {
    await db.insert(ingestRuns).values({ job: "finnhub:intraday", status: "failed", finishedAt: new Date(), error: budget.message });
    return;
  }
  const [run] = await db.insert(ingestRuns).values({ job: "finnhub:intraday", status: "running" }).returning({ id: ingestRuns.id });
  const { snapshots, errors } = await fetchQuotes(symbols, provider.credential, AbortSignal.timeout(120_000));
  await storeSnapshots(db, snapshots);
  await db
    .update(ingestRuns)
    .set({ status: errors.length ? "failed" : "success", finishedAt: new Date(), rowsWritten: snapshots.length, error: errors.length ? errors.join("\n") : null })
    .where(eq(ingestRuns.id, run!.id));
}

const providers = () => getConfig().providers;

export const JOBS: ScheduledJob[] = [
  {
    id: "fred",
    trigger: { kind: "interval", minutes: 360 },
    release: { eventKinds: ["claims"], intervalMinutes: 10, maxWaitMinutes: 180 },
    run: ingest("fred", FRED_SERIES, (db) => fredAdapter({ lastObsDate: lastObsDate(db) }), () => providers().fred),
  },
  {
    id: "treasury",
    trigger: { kind: "window", start: "16:00", end: "20:00", minutes: 15, tradingDaysOnly: true },
    async run(db, now) {
      await ingest("treasury", TREASURY_SERIES, () => treasuryAdapter(), () => NO_KEY)(db);
      const since = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
      const mismatches = await crossCheckTreasury(db, since);
      if (mismatches.length) console.error(`财政部与 FRED 不一致 ${mismatches.length} 处，已移入待确认`);
    },
  },
  {
    id: "tiingo",
    trigger: { kind: "window", start: "18:30", end: "23:30", minutes: 60, tradingDaysOnly: true },
    async run(db) {
      const series = (await marketSymbols(db)).flatMap(tiingoSeries);
      await upsertSeries(db, series);
      await ingest("tiingo", series, (d) => tiingoAdapter({ lastObsDate: lastObsDate(d) }), () => providers().tiingo)(db);
    },
  },
  {
    id: "bls",
    trigger: { kind: "daily", easternTime: "09:00" },
    release: { eventKinds: ["cpi", "nfp"], intervalMinutes: 2, maxWaitMinutes: 60 },
    run: ingest("bls", BLS_SERIES, () => blsAdapter(BLS_SERIES.map((s) => s.sourceKey)), () => NO_KEY),
  },
  {
    id: "bea",
    trigger: { kind: "daily", easternTime: "09:00" },
    release: { eventKinds: ["pce"], intervalMinutes: 2, maxWaitMinutes: 60 },
    run: ingest("bea", BEA_SERIES, () => beaAdapter(), () => providers().bea),
  },
  { id: "finnhub:intraday", trigger: { kind: "market-hours", minutes: INTRADAY_INTERVAL }, run: intraday },
  {
    id: "derive",
    trigger: { kind: "interval", minutes: 60 },
    async run(db) {
      const { errors } = await runDerive(db);
      if (errors.length) console.error(errors.join("\n"));
    },
  },
  {
    id: "signals",
    trigger: { kind: "interval", minutes: 60 },
    async run(db, now) {
      const changes = await logStateChanges(db, await evaluateAll(db, now));
      await db.insert(ingestRuns).values({ job: "signals", status: "success", finishedAt: new Date(), rowsWritten: changes.length });
      if (changes.length) console.log(`信号状态变化：${changes.join("；")}`);
    },
  },
  {
    id: "edgar",
    trigger: { kind: "interval", minutes: 60 },
    run: (db) => edgarRun(db, "edgar"),
  },
  {
    // 财报多在美东收盘后发布：16:00–20:00 每 10 分钟检查新申报
    id: "edgar:earnings-window",
    trigger: { kind: "window", start: "16:00", end: "20:00", minutes: 10, tradingDaysOnly: true },
    run: (db) => edgarRun(db, "edgar:earnings-window"),
  },
  {
    // 台积电约每月 10 日报送上月营收 6-K
    id: "tsmc",
    trigger: { kind: "interval", minutes: 60 },
    async run(db) {
      const ua = providers().edgar;
      if (!ua.configured) return void (await db.insert(ingestRuns).values({ job: "tsmc", status: "skipped", finishedAt: new Date(), error: ua.reason }));
      const r = await runTsmc(db, ua.credential);
      if (r.processed) console.log(`台积电月营收：处理 ${r.processed} 份报告`);
      if (r.errors.length) console.error(r.errors.join("\n"));
    },
  },
  {
    id: "calendar",
    trigger: { kind: "daily", easternTime: "06:00" },
    async run(db, now) {
      const { written, errors } = await syncCalendar(db, now);
      console.log(`日程同步：${written} 个事件`);
      if (errors.length) console.error(errors.join("\n"));
    },
  },
  {
    id: "maintenance",
    trigger: { kind: "daily", easternTime: "03:00" },
    async run(db, now) {
      await pruneSnapshots(db, new Date(now.getTime() - 10 * 86_400_000));
      await db.insert(ingestRuns).values({ job: "maintenance", status: "success", finishedAt: new Date() });
    },
  },
];

async function edgarRun(db: Db, jobId: string) {
  const ua = providers().edgar;
  if (!ua.configured) return void (await db.insert(ingestRuns).values({ job: jobId, status: "skipped", finishedAt: new Date(), error: ua.reason }));
  const r = await runEdgar(db, ua.credential, jobId);
  if (r.written) console.log(`${jobId}：写入 ${r.written} 条财报数据`);
  if (r.errors.length) console.error(r.errors.join("\n"));
}

let directory: Awaited<ReturnType<typeof fetchTickerDirectory>> | undefined;

// 用 SEC 的代码表查找公司编号；进程内缓存，避免重复下载
export async function secLookup(symbol: string) {
  const ua = getConfig().providers.edgar;
  if (!ua.configured) throw new Error(ua.reason);
  directory ??= await fetchTickerDirectory(ua.credential, AbortSignal.timeout(60_000));
  return directory.get(symbol.toUpperCase());
}

export async function registerSeries(db: Db) {
  await upsertSeries(db, ALL_SERIES);
  if (getConfig().providers.edgar.configured) await ensureDefaultUniverse(db, secLookup);
}
