import type { Point } from "@/pipeline/derived";

// 由财报序列计算的比率（纯函数）。输入按期末日期对齐；缺少任一输入的期间为空。
type Obs = { obsDate: string; value: number };

const byDate = (rows: Obs[]) => new Map(rows.map((r) => [r.obsDate, r.value]));

// 毛利率：优先用申报的毛利；未申报时用营收减营业成本
export function grossMargin(revenue: Obs[], grossProfit: Obs[], cogs: Obs[]): Point[] {
  const gp = byDate(grossProfit);
  const cost = byDate(cogs);
  return revenue.map((r) => {
    const g = gp.get(r.obsDate) ?? (cost.has(r.obsDate) ? r.value - cost.get(r.obsDate)! : undefined);
    return { date: r.obsDate, value: g === undefined || r.value === 0 ? null : (g / r.value) * 100 };
  });
}

export function opMargin(revenue: Obs[], opIncome: Obs[]): Point[] {
  const op = byDate(opIncome);
  return revenue.map((r) => ({ date: r.obsDate, value: op.has(r.obsDate) && r.value !== 0 ? (op.get(r.obsDate)! / r.value) * 100 : null }));
}

// 存货天数 = 期末存货 / 同期营业成本 × 期间天数
export function inventoryDays(inventory: Obs[], cogs: Obs[], annual: boolean): Point[] {
  const inv = byDate(inventory);
  return cogs.map((c) => ({ date: c.obsDate, value: inv.has(c.obsDate) && c.value > 0 ? (inv.get(c.obsDate)! / c.value) * (annual ? 365 : 91) : null }));
}

// 同比：与约一年前（345～385 天）的同一期比较；季度截止日每年会浮动几天
export function periodYoY(rows: Obs[]): Point[] {
  return rows.map((r) => {
    const t = Date.parse(r.obsDate);
    const prev = rows.find((p) => {
      const gap = (t - Date.parse(p.obsDate)) / 86_400_000;
      return gap >= 345 && gap <= 385;
    });
    return { date: r.obsDate, value: prev && prev.value !== 0 ? (r.value / prev.value - 1) * 100 : null };
  });
}
