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
import { ALL_SERIES, BEA_SERIES, BLS_SERIES, FRED_SERIES, MARKET_ETFS, TIINGO_SERIES, TREASURY_SERIES } from "@/sources/catalog";
import { FINNHUB_LIMIT_PER_MINUTE, fetchQuotes } from "@/sources/finnhub";
import { fredAdapter } from "@/sources/fred";
import { tiingoAdapter } from "@/sources/tiingo";
import { treasuryAdapter } from "@/sources/treasury";
import type { ScheduledJob } from "@/worker/jobs";
import { crossCheckTreasury } from "./cross-check";
import { runDerive } from "./derive";

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

export const INTRADAY_SYMBOLS: readonly string[] = MARKET_ETFS;
const INTRADAY_INTERVAL = 5;

async function intraday(db: Db) {
  const provider = getConfig().providers.finnhub;
  if (!provider.configured) {
    await db.insert(ingestRuns).values({ job: "finnhub:intraday", status: "skipped", finishedAt: new Date(), error: provider.reason });
    return;
  }
  const budget = checkIntradayBudget(INTRADAY_SYMBOLS.length, INTRADAY_INTERVAL, FINNHUB_LIMIT_PER_MINUTE);
  if (!budget.ok) {
    await db.insert(ingestRuns).values({ job: "finnhub:intraday", status: "failed", finishedAt: new Date(), error: budget.message });
    return;
  }
  const [run] = await db.insert(ingestRuns).values({ job: "finnhub:intraday", status: "running" }).returning({ id: ingestRuns.id });
  const { snapshots, errors } = await fetchQuotes([...INTRADAY_SYMBOLS], provider.credential, AbortSignal.timeout(60_000));
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
    run: ingest("tiingo", TIINGO_SERIES, (db) => tiingoAdapter({ lastObsDate: lastObsDate(db) }), () => providers().tiingo),
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
    id: "maintenance",
    trigger: { kind: "daily", easternTime: "03:00" },
    async run(db, now) {
      await pruneSnapshots(db, new Date(now.getTime() - 10 * 86_400_000));
      await db.insert(ingestRuns).values({ job: "maintenance", status: "success", finishedAt: new Date() });
    },
  },
];

export async function registerSeries(db: Db) {
  await upsertSeries(db, ALL_SERIES);
}

