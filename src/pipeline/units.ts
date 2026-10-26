// 单位换算：只换算登记过的单位，未知单位直接报错，不猜测
const USD_SCALE: Record<string, number> = {
  "U.S. Dollars": 1,
  "Thousands of U.S. Dollars": 1e3,
  "Millions of U.S. Dollars": 1e6,
  "Billions of U.S. Dollars": 1e9,
  "Trillions of U.S. Dollars": 1e12,
};

export class UnitError extends Error {}

export function convertUsd(value: number, from: string, to: string): number {
  const a = USD_SCALE[from];
  const b = USD_SCALE[to];
  if (a === undefined || b === undefined) throw new UnitError(`未登记的单位换算：${from} → ${to}`);
  return (value * a) / b;
}
