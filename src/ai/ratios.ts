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

// 自由现金流 = 经营现金流 − 资本开支（任一缺失则为空）
export function freeCashFlow(ocf: Obs[], capex: Obs[]): Point[] {
  const cap = byDate(capex);
  return ocf.map((o) => ({ date: o.obsDate, value: cap.has(o.obsDate) ? o.value - cap.get(o.obsDate)! : null }));
}

// 现金及短期投资 = 现金及等价物 + 短期投资（未申报短期投资时按现金及等价物）
export function totalCash(cash: Obs[], stInv: Obs[]): Point[] {
  const inv = byDate(stInv);
  return cash.map((c) => ({ date: c.obsDate, value: c.value + (inv.get(c.obsDate) ?? 0) }));
}

// 总债务 = 短期债务 + 长期债务（仅在至少申报了其中一项的日期计算，不把未申报伪造为 0）
export function totalDebt(stDebt: Obs[], ltDebt: Obs[]): Point[] {
  const st = byDate(stDebt);
  const lt = byDate(ltDebt);
  const dates = [...new Set([...st.keys(), ...lt.keys()])].sort();
  return dates.map((date) => ({ date, value: (st.get(date) ?? 0) + (lt.get(date) ?? 0) }));
}

// 净现金 = 现金及短期投资 − 总债务（缺少现金或未申报任何债务科目时为空）
export function netCash(cash: Obs[], stInv: Obs[], stDebt: Obs[], ltDebt: Obs[]): Point[] {
  const inv = byDate(stInv);
  const st = byDate(stDebt);
  const lt = byDate(ltDebt);
  return cash.map((c) => {
    const hasDebt = st.has(c.obsDate) || lt.has(c.obsDate);
    if (!hasDebt) return { date: c.obsDate, value: null };
    return { date: c.obsDate, value: c.value + (inv.get(c.obsDate) ?? 0) - ((st.get(c.obsDate) ?? 0) + (lt.get(c.obsDate) ?? 0)) };
  });
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
