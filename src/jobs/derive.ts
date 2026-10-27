import { eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { derivedValues, ingestRuns } from "@/db/schema";
import { adjustedClose } from "@/pipeline/adjust";
import { alignAsOf, drawdown, FORMULA_VERSION, ratio, sma, type Point } from "@/pipeline/derived";
import { readSeries } from "@/pipeline/store";
import { convertUsd } from "@/pipeline/units";
import { MARKET_ETFS } from "@/sources/catalog";

const CHUNK = 1000;

export async function saveDerived(db: Db, derivedId: string, points: Point[]) {
  await db.transaction(async (tx) => {
    await tx.delete(derivedValues).where(eq(derivedValues.derivedId, derivedId));
    const rows = points.map((p) => ({ derivedId, obsDate: p.date, value: p.value, formulaVersion: FORMULA_VERSION, inputStatus: p.value === null ? "missing" : "ok" }));
    for (let i = 0; i < rows.length; i += CHUNK) await tx.insert(derivedValues).values(rows.slice(i, i + CHUNK));
  });
}

export async function readDerived(db: Db, derivedId: string): Promise<Point[]> {
  const rows = await db.select().from(derivedValues).where(eq(derivedValues.derivedId, derivedId)).orderBy(derivedValues.obsDate);
  return rows.map((r) => ({ date: r.obsDate, value: r.value }));
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

  for (const t of MARKET_ETFS) {
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

  await db
    .update(ingestRuns)
    .set({ status: errors.length ? "failed" : "success", finishedAt: new Date(), rowsWritten: written, error: errors.length ? errors.join("\n") : null })
    .where(eq(ingestRuns.id, run!.id));
  return { written, errors };
}

