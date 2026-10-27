import type { Point } from "./derived";

// 由未复权收盘价、现金分红与拆股系数计算复权收盘价（以最新价格为基准向前调整）。
// 拆股日：之前的价格除以拆股系数；除息日：之前的价格乘以 (1 - 分红 / 前一日收盘价)。
export function adjustedClose(
  closes: { obsDate: string; value: number }[],
  dividends: { obsDate: string; value: number }[],
  splits: { obsDate: string; value: number }[],
): Point[] {
  const sorted = [...closes].sort((a, b) => a.obsDate.localeCompare(b.obsDate));
  const div = new Map(dividends.map((d) => [d.obsDate, d.value]));
  const split = new Map(splits.map((s) => [s.obsDate, s.value]));
  const out: Point[] = new Array(sorted.length);
  let factor = 1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const day = sorted[i]!;
    out[i] = { date: day.obsDate, value: day.value * factor };
    const prev = sorted[i - 1];
    if (!prev) break;
    const s = split.get(day.obsDate);
    if (s && s !== 1) factor /= s;
    const d = div.get(day.obsDate);
    // 分红按拆股后的每股金额计算，前一日收盘价要先换算到拆股后的口径
    if (d && d > 0 && prev.value > 0) factor *= 1 - d / (prev.value / (s && s !== 1 ? s : 1));
  }
  return out;
}
