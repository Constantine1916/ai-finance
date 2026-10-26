// 派生指标纯函数。输入按日期升序；任一输入缺失时输出为 null，不用零或估算值填补。

export interface Point {
  date: string;
  value: number | null;
}

export const FORMULA_VERSION = 1;

function lagMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function byDate(points: Point[]) {
  return new Map(points.map((p) => [p.date, p.value]));
}

// 同比（%）：月度或季度序列，与 12 个月前同一日期比较
export function yoy(points: Point[]): Point[] {
  const index = byDate(points);
  return points.map((p) => {
    const prev = index.get(lagMonths(p.date, 12));
    return { date: p.date, value: p.value === null || prev == null || prev === 0 ? null : (p.value / prev - 1) * 100 };
  });
}

// 3 个月年化变化率（%）：((当期 / 3 个月前) ^ 4 - 1)
export function annualized3m(points: Point[]): Point[] {
  const index = byDate(points);
  return points.map((p) => {
    const prev = index.get(lagMonths(p.date, 3));
    return { date: p.date, value: p.value === null || prev == null || prev <= 0 ? null : ((p.value / prev) ** 4 - 1) * 100 };
  });
}

// 简单移动平均：窗口内任一值缺失则为 null
export function sma(points: Point[], window: number): Point[] {
  return points.map((p, i) => {
    if (i + 1 < window) return { date: p.date, value: null };
    const slice = points.slice(i + 1 - window, i + 1).map((x) => x.value);
    return { date: p.date, value: slice.some((v) => v === null) ? null : (slice as number[]).reduce((a, b) => a + b, 0) / window };
  });
}

// 距窗口内最高点的回撤（%，≤ 0）
export function drawdown(points: Point[], window: number): Point[] {
  return points.map((p, i) => {
    if (p.value === null) return { date: p.date, value: null };
    const slice = points.slice(Math.max(0, i + 1 - window), i + 1).map((x) => x.value);
    if (slice.some((v) => v === null)) return { date: p.date, value: null };
    const high = Math.max(...(slice as number[]));
    return { date: p.date, value: (p.value / high - 1) * 100 };
  });
}

// 两个序列按日期对齐求比值，只保留两边都有值的日期
export function ratio(a: Point[], b: Point[]): Point[] {
  const right = byDate(b);
  return a
    .filter((p) => right.has(p.date))
    .map((p) => {
      const d = right.get(p.date);
      return { date: p.date, value: p.value === null || d == null || d === 0 ? null : p.value / d };
    });
}

// 当前值在窗口内的百分位（0–100）
export function percentileRank(points: Point[], window: number): Point[] {
  return points.map((p, i) => {
    if (p.value === null || i + 1 < window) return { date: p.date, value: null };
    const slice = points.slice(i + 1 - window, i + 1).map((x) => x.value);
    if (slice.some((v) => v === null)) return { date: p.date, value: null };
    const below = (slice as number[]).filter((v) => v <= p.value!).length;
    return { date: p.date, value: (below / window) * 100 };
  });
}

// 低频序列按“最近一个不晚于该日期的值”对齐到高频日期（用于净流动性等跨频率计算）
export function alignAsOf(target: string[], source: Point[], maxAgeDays: number): Point[] {
  const sorted = [...source].sort((x, y) => x.date.localeCompare(y.date));
  let j = -1;
  return target.map((date) => {
    while (j + 1 < sorted.length && sorted[j + 1]!.date <= date) j++;
    const p = j >= 0 ? sorted[j]! : undefined;
    const ageDays = p ? (Date.parse(date) - Date.parse(p.date)) / 86_400_000 : Infinity;
    return { date, value: p && ageDays <= maxAgeDays ? p.value : null };
  });
}
