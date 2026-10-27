import type { Point } from "@/pipeline/derived";

// 触发后的市场表现：3、6、12 个月（63、126、252 个交易日）收益与 12 个月内最大跌幅
export interface Forward {
  r3m: number | null;
  r6m: number | null;
  r12m: number | null;
  maxDrop12m: number | null;
}

export function forwardStats(triggerDate: string, prices: Point[]): Forward {
  const v = prices.filter((p): p is { date: string; value: number } => p.value !== null);
  const i = v.findIndex((p) => p.date >= triggerDate);
  const empty = { r3m: null, r6m: null, r12m: null, maxDrop12m: null };
  if (i < 0 || v[i]!.date > addDaysLoose(triggerDate, 7)) return empty; // 触发日之前没有价格数据
  const base = v[i]!.value;
  const at = (n: number) => (v[i + n] ? (v[i + n]!.value / base - 1) * 100 : null);
  const window = v.slice(i, i + 253);
  return {
    r3m: at(63),
    r6m: at(126),
    r12m: at(252),
    maxDrop12m: window.length === 253 ? (Math.min(...window.map((p) => p.value)) / base - 1) * 100 : null,
  };
}

function addDaysLoose(d: string, n: number) {
  return new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
}

export function summarize(rows: Forward[]) {
  const done = rows.map((r) => r.r12m).filter((x): x is number => x !== null).sort((a, b) => a - b);
  return {
    total: rows.length,
    evaluated: done.length,
    negative12m: done.filter((x) => x < 0).length,
    median12m: done.length ? (done.length % 2 ? done[(done.length - 1) / 2]! : (done[done.length / 2 - 1]! + done[done.length / 2]!) / 2) : null,
  };
}
