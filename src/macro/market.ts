import type { Db } from "@/db/types";
import { readDerived } from "@/jobs/derive";
import { easternDate } from "@/pipeline/calendar";
import { latestPrice } from "@/pipeline/intraday";
import { readSeries } from "@/pipeline/store";
import type { Point } from "@/pipeline/derived";

// 收益率曲线：最新、约 3 个月前、约 12 个月前（取不晚于目标日期的最近交易日）
export const CURVE_TENORS = [
  { label: "3M", fred: "fred:DGS3MO", treasury: "treasury:3MO" },
  { label: "2Y", fred: "fred:DGS2", treasury: "treasury:2Y" },
  { label: "5Y", fred: "fred:DGS5", treasury: "treasury:5Y" },
  { label: "10Y", fred: "fred:DGS10", treasury: "treasury:10Y" },
  { label: "20Y", fred: "fred:DGS20", treasury: "treasury:20Y" },
  { label: "30Y", fred: "fred:DGS30", treasury: "treasury:30Y" },
];

export async function yieldCurves(db: Db) {
  const merged = await Promise.all(
    CURVE_TENORS.map(async (t) => {
      const fred = await readSeries(db, t.fred);
      const last = fred.at(-1)?.obsDate ?? "";
      const rows = [...fred, ...(await readSeries(db, t.treasury)).filter((p) => p.obsDate > last)];
      return new Map(rows.map((r) => [r.obsDate, r.value]));
    }),
  );
  // 只用所有期限都有值的日期，保证一条曲线来自同一天
  const common = [...merged[0]!.keys()].filter((d) => merged.every((m) => m.has(d))).sort();
  const latest = common.at(-1);
  if (!latest) return [];
  const before = (months: number) => {
    const target = new Date(`${latest}T00:00:00Z`);
    target.setUTCMonth(target.getUTCMonth() - months);
    const t = target.toISOString().slice(0, 10);
    return [...common].reverse().find((d) => d <= t);
  };
  return [
    { label: "最新", date: latest },
    { label: "3 个月前", date: before(3) },
    { label: "12 个月前", date: before(12) },
  ]
    .filter((c): c is { label: string; date: string } => Boolean(c.date))
    .map((c) => ({ ...c, values: merged.map((m) => m.get(c.date)!) }));
}

export const ETF_ROWS = [
  { symbol: "SPY", name: "标普 500", proxy: null },
  { symbol: "QQQ", name: "纳斯达克 100", proxy: null },
  { symbol: "IWM", name: "罗素 2000", proxy: "以 IWM 代替罗素 2000 指数" },
  { symbol: "SOXX", name: "半导体", proxy: "以 SOXX 代替费城半导体指数" },
  { symbol: "RSP", name: "标普 500 等权", proxy: null },
];

const pct = (a: number, b: number | null | undefined) => (b ? (a / b - 1) * 100 : null);

function valueOnOrBefore(points: Point[], date: string) {
  for (let i = points.length - 1; i >= 0; i--) if (points[i]!.date <= date && points[i]!.value !== null) return points[i]!.value;
  return null;
}

export async function etfTable(db: Db, now = new Date()) {
  return Promise.all(
    ETF_ROWS.map(async (row) => {
      const adj = await readDerived(db, `adj:${row.symbol}`);
      const sma200 = (await readDerived(db, `sma200:${row.symbol}`)).at(-1)?.value ?? null;
      const view = await latestPrice(db, row.symbol, `tiingo:${row.symbol}:close`, now);
      if (view.kind === "none" || adj.length === 0) return { ...row, view, price: null, vs200: null, dd52w: null, r1m: null, r3m: null, ytd: null };
      const price = view.price;
      // 复权价以最新收盘为基准，最新价与未复权价相同，盘中价可以直接与复权历史比较
      const window = adj.slice(-252).map((p) => p.value ?? 0);
      const high = Math.max(...window, view.kind === "provisional" ? price : 0);
      // 盘中价属于今天，比最新收盘多一个交易日，回看天数相应少一天
      const offset = view.kind === "provisional" ? 1 : 0;
      const ago = (tradingDays: number) => adj[adj.length - 1 - (tradingDays - offset)]?.value ?? null;
      const prevYearEnd = valueOnOrBefore(adj, `${Number(easternDate(now).slice(0, 4)) - 1}-12-31`);
      return {
        ...row,
        view,
        price,
        vs200: pct(price, sma200),
        dd52w: pct(price, high),
        r1m: pct(price, ago(21)),
        r3m: pct(price, ago(63)),
        ytd: pct(price, prevYearEnd),
      };
    }),
  );
}
