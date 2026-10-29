import { eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { derivedValues, filings, ingestRuns, observations } from "@/db/schema";
import { adjustedClose } from "@/pipeline/adjust";
import { alignAsOf, drawdown, FORMULA_VERSION, ratio, sma, type Point } from "@/pipeline/derived";
import { readSeries } from "@/pipeline/store";
import { convertUsd } from "@/pipeline/units";
import { MARKET_ETFS } from "@/sources/catalog";
import { aggregateByCalendarQuarter, quarterEndDate, threeMonthYoY, valuationSeries } from "@/ai/metrics";
import { activeMembers } from "@/ai/universe";
import { edgarSeriesId } from "./edgar";

const CHUNK = 1000;

// status：可选的逐点状态（例如亏损时市盈率为空且状态为 loss），默认按是否有值判断
export async function saveDerived(db: Db, derivedId: string, points: (Point & { status?: string })[]) {
  await db.transaction(async (tx) => {
    await tx.delete(derivedValues).where(eq(derivedValues.derivedId, derivedId));
    const rows = points.map((p) => ({ derivedId, obsDate: p.date, value: p.value, formulaVersion: FORMULA_VERSION, inputStatus: p.status ?? (p.value === null ? "missing" : "ok") }));
    for (let i = 0; i < rows.length; i += CHUNK) await tx.insert(derivedValues).values(rows.slice(i, i + CHUNK));
  });
}

export async function readDerivedWithStatus(db: Db, derivedId: string) {
  const rows = await db.select().from(derivedValues).where(eq(derivedValues.derivedId, derivedId)).orderBy(derivedValues.obsDate);
  return rows.map((r) => ({ date: r.obsDate, value: r.value, status: r.inputStatus }));
}

export async function readDerived(db: Db, derivedId: string): Promise<Point[]> {
  const rows = await db.select().from(derivedValues).where(eq(derivedValues.derivedId, derivedId)).orderBy(derivedValues.obsDate);
  return rows.map((r) => ({ date: r.obsDate, value: r.value }));
}

// 股数连同其所在申报的提交日期（来源链接即申报地址）：用于判断股数是拆股前还是拆股后的口径
async function sharesWithFiled(db: Db, seriesId: string) {
  return db
    .select({ obsDate: observations.obsDate, value: observations.value, filed: filings.filedAt })
    .from(observations)
    .leftJoin(filings, eq(filings.url, observations.sourceRef))
    .where(eq(observations.seriesId, seriesId))
    .orderBy(observations.obsDate);
}

const asPoints = (rows: { obsDate: string; value: number }[]): Point[] => rows.map((r) => ({ date: r.obsDate, value: r.value }));

// 净流动性（十亿美元）= 美联储总资产 − 财政部一般账户 − 隔夜逆回购；以美联储周度日期（周三）为准
export function netLiquidity(walcl: Point[], tga: Point[], rrp: Point[]): Point[] {
  const dates = walcl.map((p) => p.date);
  const tgaAligned = alignAsOf(dates, tga, 0);
  const rrpAligned = alignAsOf(dates, rrp, 7);
  return walcl.map((p, i) => {
    const t = tgaAligned[i]!.value;
    const r = rrpAligned[i]!.value;
    if (p.value === null || t === null || r === null) return { date: p.date, value: null };
    const toBillions = (v: number, unit: string) => convertUsd(v, unit, "Billions of U.S. Dollars");
    return { date: p.date, value: toBillions(p.value, "Millions of U.S. Dollars") - toBillions(t, "Millions of U.S. Dollars") - toBillions(r, "Billions of US Dollars") };
  });
}

// 每次运行全量重算派生序列（数据量小，重算比增量更不容易出错）
export async function runDerive(db: Db) {
  const [run] = await db.insert(ingestRuns).values({ job: "derive", status: "running" }).returning({ id: ingestRuns.id });
  const errors: string[] = [];
  let written = 0;
  const save = async (id: string, points: Point[]) => {
    await saveDerived(db, id, points);
    written += points.length;
  };
  const adj = new Map<string, Point[]>();

  const members = await activeMembers(db);
  for (const t of [...MARKET_ETFS, ...members.map((m) => m.symbol)]) {
    try {
      const points = adjustedClose(await readSeries(db, `tiingo:${t}:close`), await readSeries(db, `tiingo:${t}:div`), await readSeries(db, `tiingo:${t}:split`));
      if (points.length === 0) continue;
      adj.set(t, points);
      await save(`adj:${t}`, points);
      await save(`sma200:${t}`, sma(points, 200));
      await save(`dd52w:${t}`, drawdown(points, 252));
    } catch (error) {
      errors.push(`${t}：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const [a, b] of [["IWM", "SPY"], ["RSP", "SPY"], ["SOXX", "SPY"], ["HYG", "IEF"]] as const) {
    const pa = adj.get(a);
    const pb = adj.get(b);
    if (pa && pb) await save(`ratio:${a}/${b}`, ratio(pa, pb));
  }
  try {
    await save("net-liquidity", netLiquidity(asPoints(await readSeries(db, "fred:WALCL")), asPoints(await readSeries(db, "fred:WTREGEN")), asPoints(await readSeries(db, "fred:RRPONTSYD"))));
  } catch (error) {
    errors.push(`净流动性：${error instanceof Error ? error.message : String(error)}`);
  }
  await save("ratio:VIX/VIX3M", ratio(asPoints(await readSeries(db, "fred:VIXCLS")), asPoints(await readSeries(db, "fred:VXVCLS"))));

  // 1B：云厂商资本开支合计（只保留完整季度）、台积电 3 个月平均同比、个股估值（周度）
  try {
    const hyperscalers = members.filter((m) => m.inHyperscalerCapex);
    const capex = aggregateByCalendarQuarter(Object.fromEntries(await Promise.all(hyperscalers.map(async (m) => [m.symbol, await readSeries(db, edgarSeriesId(m.symbol, "capex"))] as const))));
    const complete = capex.filter((q) => q.total !== null);
    await save("capex:hyperscalers", complete.map((q) => ({ date: quarterEndDate(q.cq), value: q.total })));
    await save("capex:hyperscalers:yoy", complete.map((q) => ({ date: quarterEndDate(q.cq), value: q.yoy })));
    await save("tsmc:revenue:3m-yoy", threeMonthYoY(await readSeries(db, "tsmc:revenue")));
  } catch (error) {
    errors.push(`AI 产业汇总：${error instanceof Error ? error.message : String(error)}`);
  }
  for (const m of members) {
    try {
      const v = valuationSeries({
        closes: await readSeries(db, `tiingo:${m.symbol}:close`),
        splits: await readSeries(db, `tiingo:${m.symbol}:split`),
        netIncome: await readSeries(db, edgarSeriesId(m.symbol, "netIncome")),
        shares: await sharesWithFiled(db, edgarSeriesId(m.symbol, "dilutedShares")),
        equity: await readSeries(db, edgarSeriesId(m.symbol, "equity")),
      });
      if (v.length === 0) continue;
      await saveDerived(db, `pe:${m.symbol}`, v.map((x) => ({ date: x.date, value: x.pe, status: x.peStatus })));
      await saveDerived(db, `pb:${m.symbol}`, v.map((x) => ({ date: x.date, value: x.pb, status: x.pbStatus })));
      written += v.length * 2;
    } catch (error) {
      errors.push(`${m.symbol} 估值：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await db
    .update(ingestRuns)
    .set({ status: errors.length ? "failed" : "success", finishedAt: new Date(), rowsWritten: written, error: errors.length ? errors.join("\n") : null })
    .where(eq(ingestRuns.id, run!.id));
  return { written, errors };
}
