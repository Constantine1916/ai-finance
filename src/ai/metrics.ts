import { calendarQuarter } from "./extract";
import type { Point } from "@/pipeline/derived";

type Obs = { obsDate: string; value: number };

// 云厂商资本开支合计：按日历季度汇总；任一成员缺少该季度时，合计标为不完整，不参与同比
export function aggregateByCalendarQuarter(bySymbol: Record<string, Obs[]>) {
  const symbols = Object.keys(bySymbol);
  const quarters = new Map<string, Record<string, number>>();
  for (const [sym, rows] of Object.entries(bySymbol)) {
    for (const r of rows) {
      const cq = calendarQuarter(r.obsDate);
      quarters.set(cq, { ...(quarters.get(cq) ?? {}), [sym]: r.value });
    }
  }
  const out = [...quarters.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cq, byCompany]) => {
      const missing = symbols.filter((s) => byCompany[s] === undefined);
      return { cq, byCompany, missing, total: missing.length ? null : Object.values(byCompany).reduce((a, b) => a + b, 0) };
    });
  // 同比：本季与去年同季都完整时才计算
  const totals = new Map(out.map((q) => [q.cq, q.total]));
  return out.map((q) => {
    const [y, n] = q.cq.split("Q");
    const prev = totals.get(`${Number(y) - 1}Q${n}`);
    return { ...q, yoy: q.total !== null && prev ? (q.total / prev - 1) * 100 : null };
  });
}

// 日历季度对应的日期（季末），用于时间轴
export function quarterEndDate(cq: string) {
  const [y, n] = cq.split("Q");
  const end = new Date(Date.UTC(Number(y), Number(n) * 3, 0));
  return end.toISOString().slice(0, 10);
}

// 台积电 3 个月平均同比：最近 3 个月合计相对去年同期 3 个月合计
export function threeMonthYoY(monthly: Obs[]): Point[] {
  const byMonth = new Map(monthly.map((r) => [r.obsDate, r.value]));
  const shift = (d: string, m: number) => {
    const x = new Date(`${d}T00:00:00Z`);
    x.setUTCMonth(x.getUTCMonth() + m);
    return x.toISOString().slice(0, 10);
  };
  return monthly.map((r) => {
    const cur = [0, -1, -2].map((m) => byMonth.get(shift(r.obsDate, m)));
    const prev = [-12, -13, -14].map((m) => byMonth.get(shift(r.obsDate, m)));
    if (cur.some((v) => v === undefined) || prev.some((v) => v === undefined)) return { date: r.obsDate, value: null };
    const sum = (a: (number | undefined)[]) => a.reduce<number>((x, y) => x + (y ?? 0), 0);
    return { date: r.obsDate, value: (sum(cur) / sum(prev) - 1) * 100 };
  });
}

// 估值：财报在期末 60 天后视为可得（避免使用当时尚未公布的数据）；拆股后按系数调整股数
export const FILING_LAG_DAYS = 60;

export interface ValuationInputs {
  closes: Obs[]; // 未复权收盘价
  splits: Obs[];
  netIncome: Obs[]; // 单季
  shares: (Obs & { filed?: string | null })[]; // 单季稀释加权股数；filed 为该数值所在申报的提交日期
  equity: Obs[]; // 期末
}

export interface ValuationPoint {
  date: string;
  pe: number | null;
  pb: number | null;
  peStatus: "ok" | "loss" | "missing";
  pbStatus: "ok" | "negative" | "missing";
}

const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

export function valuationSeries(input: ValuationInputs, sample: "weekly" | "daily" = "weekly"): ValuationPoint[] {
  const available = <T extends Obs>(rows: T[], date: string) => rows.filter((r) => addDays(r.obsDate, FILING_LAG_DAYS) <= date);
  const ni = [...input.netIncome].sort((a, b) => a.obsDate.localeCompare(b.obsDate));
  const out: ValuationPoint[] = [];
  const closes = [...input.closes].sort((a, b) => a.obsDate.localeCompare(b.obsDate));
  closes.forEach((c, i) => {
    const next = closes[i + 1];
    const lastOfWeek = !next || Math.floor(Date.parse(next.obsDate) / 604_800_000) !== Math.floor(Date.parse(c.obsDate) / 604_800_000);
    if (sample === "weekly" && !lastOfWeek) return;
    const shares = available(input.shares, c.obsDate).at(-1);
    const quarters = available(ni, c.obsDate).slice(-4);
    const equity = available(input.equity, c.obsDate).at(-1);
    if (!shares) return out.push({ date: c.obsDate, pe: null, pb: null, peStatus: "missing", pbStatus: "missing" });
    // 拆股后提交的财报会把以前期间的股数追溯调整为拆股后口径，股数的口径由“提交日期”决定（未知时按期末）。
    // 把股数换算到价格当日的口径：股数提交之后、价格日期之前的拆股乘以系数；
    // 价格日期之后、股数提交之前的拆股（股数口径比价格新）除以系数。
    const basisDate = shares.filed ?? shares.obsDate;
    const factor = input.splits.reduce((a, s) => {
      if (s.obsDate > basisDate && s.obsDate <= c.obsDate) return a * s.value;
      if (s.obsDate > c.obsDate && s.obsDate <= basisDate) return a / s.value;
      return a;
    }, 1);
    const marketCap = c.value * shares.value * factor;
    const consecutive = quarters.length === 4 && Date.parse(quarters[3]!.obsDate) - Date.parse(quarters[0]!.obsDate) <= 300 * 86_400_000;
    const ttm = consecutive ? quarters.reduce((a, q) => a + q.value, 0) : null;
    out.push({
      date: c.obsDate,
      pe: ttm !== null && ttm > 0 ? marketCap / ttm : null,
      peStatus: ttm === null ? "missing" : ttm > 0 ? "ok" : "loss",
      pb: equity && equity.value > 0 ? marketCap / equity.value : null,
      pbStatus: !equity ? "missing" : equity.value > 0 ? "ok" : "negative",
    });
  });
  return out;
}

export function historyRange(values: (number | null)[]) {
  const v = values.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const current = values.at(-1) ?? null;
  return {
    min: v[0]!,
    median: v[Math.floor(v.length / 2)]!,
    max: v[v.length - 1]!,
    percentile: current === null ? null : (v.filter((x) => x <= current).length / v.length) * 100,
  };
}
