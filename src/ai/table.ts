import { eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { series } from "@/db/schema";
import { readDerivedWithStatus } from "@/jobs/derive";
import { edgarSeriesId } from "@/jobs/edgar";
import { priceStats } from "@/macro/market";
import { readSeries } from "@/pipeline/store";
import { historyRange } from "./metrics";
import { freeCashFlow, grossMargin, inventoryDays, netCash, periodYoY } from "./ratios";
import { activeMembers } from "./universe";

const last = <T extends { value: number | null }>(rows: T[]) => [...rows].reverse().find((r) => r.value !== null) ?? null;

// 关注池总表：价格、相对强弱与最新一期基本面、估值
export async function universeTable(db: Db, now = new Date()) {
  const [members, soxx, spy] = await Promise.all([activeMembers(db), priceStats(db, "SOXX", now), priceStats(db, "SPY", now)]);
  return Promise.all(
    members.map(async (m) => {
      const annual = (await readSeries(db, edgarSeriesId(m.symbol, "revenue"))).length === 0;
      const read = (metric: Parameters<typeof edgarSeriesId>[1], instant = false) => readSeries(db, edgarSeriesId(m.symbol, metric, annual && !instant));
      const [price, revenue, gp, cogs, ocf, capex, cash, stInv, stDebt, ltDebt, shares, pe, pb, revMeta] = await Promise.all([
        priceStats(db, m.symbol, now),
        read("revenue"),
        read("grossProfit"),
        read("cogs"),
        read("ocf"),
        read("capex"),
        read("cash", true),
        read("shortTermInvestments", true),
        read("shortTermDebt", true),
        read("longTermDebt", true),
        read("dilutedShares"),
        readDerivedWithStatus(db, `pe:${m.symbol}`),
        readDerivedWithStatus(db, `pb:${m.symbol}`),
        db.select({ unit: series.unit }).from(series).where(eq(series.id, edgarSeriesId(m.symbol, "revenue", annual))).limit(1),
      ]);
      const yoy = last(periodYoY(revenue));
      const margin = last(grossMargin(revenue, gp, cogs));
      const fcfPoint = last(freeCashFlow(ocf, capex));
      const netCashPoint = last(netCash(cash, stInv, stDebt, ltDebt));
      const dilutionPoint = last(periodYoY(shares));
      return {
        ...m,
        annual,
        currency: revMeta[0]?.unit ?? "USD",
        price,
        rel3mSoxx: price.r3m !== null && soxx.r3m !== null ? price.r3m - soxx.r3m : null,
        rel3mSpy: price.r3m !== null && spy.r3m !== null ? price.r3m - spy.r3m : null,
        lastPeriod: revenue.at(-1)?.obsDate ?? null,
        revenueYoY: yoy && yoy.date === revenue.at(-1)?.obsDate ? yoy.value : null,
        grossMargin: margin && margin.date === revenue.at(-1)?.obsDate ? margin.value : null,
        fcf: fcfPoint ? fcfPoint.value : null,
        netCash: netCashPoint ? netCashPoint.value : null,
        shareDilution: dilutionPoint ? dilutionPoint.value : null,
        pe: pe.at(-1) ?? null,
        pb: pb.at(-1) ?? null,
      };
    }),
  );
}

// 周期股视图：毛利率、存货天数、市净率的当前值与历史位置（2010 年以来）
export async function cyclicalView(db: Db, symbol: string) {
  const read = (metric: Parameters<typeof edgarSeriesId>[1]) => readSeries(db, edgarSeriesId(symbol, metric));
  const since = (rows: { date: string; value: number | null }[]) => rows.filter((r) => r.date >= "2010-01-01");
  const [revenue, gp, cogs, inventory, pb] = await Promise.all([read("revenue"), read("grossProfit"), read("cogs"), read("inventory"), readDerivedWithStatus(db, `pb:${symbol}`)]);
  const margins = since(grossMargin(revenue, gp, cogs));
  const days = since(inventoryDays(inventory, cogs, false));
  const pbs = since(pb);
  return {
    symbol,
    margin: { current: last(margins), range: historyRange(margins.map((m) => m.value).filter((v) => v !== null)) },
    inventoryDays: { current: last(days), range: historyRange(days.map((m) => m.value).filter((v) => v !== null)) },
    pb: { current: pbs.at(-1) ?? null, range: historyRange(pbs.map((p) => p.value).filter((v) => v !== null)) },
  };
}
