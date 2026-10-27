import { yoy, type Point } from "@/pipeline/derived";

// 周期象限：增长轴 = 工业产出同比相对 3 个月前的变化；通胀轴 = 核心 CPI 同比相对 3 个月前的变化
export const QUADRANT_FORMULA = "增长轴：工业产出（INDPRO）同比减去 3 个月前的同比；通胀轴：核心 CPI（CPILFESL）同比减去 3 个月前的同比。单位均为百分点。";

export type QuadrantName = "复苏" | "过热" | "滞胀" | "衰退";

export function quadrantName(growth: number, inflation: number): QuadrantName {
  if (growth >= 0) return inflation >= 0 ? "过热" : "复苏";
  return inflation >= 0 ? "滞胀" : "衰退";
}

function momentum(points: Point[]) {
  const y = yoy(points);
  const index = new Map(y.map((p) => [p.date, p.value]));
  return y.map((p) => {
    const d = new Date(`${p.date}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 3);
    const prev = index.get(d.toISOString().slice(0, 10));
    return { date: p.date, value: p.value === null || prev == null ? null : p.value - prev };
  });
}

// 只用两轴都有数据的月份；不外推到尚未公布的月份
export function quadrantTrail(industrial: Point[], coreCpi: Point[], months = 12) {
  const g = new Map(momentum(industrial).map((p) => [p.date, p.value]));
  const trail = momentum(coreCpi)
    .filter((p) => p.value !== null && g.get(p.date) != null)
    .map((p) => ({ date: p.date, growth: g.get(p.date)!, inflation: p.value!, name: quadrantName(g.get(p.date)!, p.value!) }));
  return trail.slice(-months);
}
