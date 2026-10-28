import type { Fact } from "@/sources/edgar";
import { PERIODIC_FORMS } from "@/sources/edgar";

// 从 XBRL 事实中提取单季与年度数值。
// 季报的利润表通常同时给出 3 个月数值与年初累计值，现金流量表只给年初累计值；
// 优先取 3 个月数值，没有时用累计值相减（Q2 = 半年累计 − Q1，Q4 = 全年 − 前三季累计）。

export interface PeriodValue {
  end: string;
  start?: string;
  value: number;
  accn: string;
  form: string;
  filed: string;
  concept: string;
  derived: boolean; // 由累计值相减得到
  restatedFrom?: { value: number; accn: string }; // 同一期间较早申报的不同数值
}

const days = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
const isQuarter = (f: Fact) => f.start !== undefined && days(f.start, f.end) >= 80 && days(f.start, f.end) <= 100;
const isAnnual = (f: Fact) => f.start !== undefined && days(f.start, f.end) >= 340 && days(f.start, f.end) <= 380;
const isLonger = (f: Fact) => f.start !== undefined && days(f.start, f.end) > 100;

// 同一期间取最晚申报的数值；较早申报且数值不同的视为重述前数值
function latestByPeriod(facts: Fact[]) {
  const groups = new Map<string, Fact[]>();
  for (const f of facts) {
    if (!PERIODIC_FORMS.has(f.form)) continue;
    const key = `${f.start ?? ""}|${f.end}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const out = new Map<string, { latest: Fact; earliest: Fact; restatedFrom?: Fact }>();
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => a.filed.localeCompare(b.filed));
    const latest = sorted[sorted.length - 1]!;
    const earliest = sorted[0]!;
    const earlier = [...sorted].reverse().find((f) => f.val !== latest.val);
    out.set(key, { latest, earliest, restatedFrom: earlier });
  }
  return out;
}

// suspect：所有候选科目中“截止日 + 数值”与某个累计或年度数值完全相同的组合。
// 例如甲骨文 2020 财年 10-K 把全年营收标成了 3 个月期间，这类单季数值不能采用。
function pick(byPeriod: ReturnType<typeof latestByPeriod>, concept: string, end: string, suspect: Set<string>, additive: boolean, original: boolean): PeriodValue | null {
  const choose = (v: { latest: Fact; earliest: Fact }) => (original ? v.earliest : v.latest);
  const all = [...byPeriod.values()].map(choose);
  const direct = [...byPeriod.values()].find((v) => choose(v).end === end && isQuarter(choose(v)) && !suspect.has(`${end}|${choose(v).val}`));
  if (direct) {
    const f = choose(direct);
    return { end, start: f.start, value: f.val, accn: f.accn, form: f.form, filed: f.filed, concept, derived: false, restatedFrom: direct.restatedFrom ? { value: direct.restatedFrom.val, accn: direct.restatedFrom.accn } : undefined };
  }
  if (!additive) return null;
  // 累计值相减：本期累计（或全年）与同一起点、约 3 个月前截止的累计值
  const cumulative = all.filter((f) => f.end === end && isLonger(f)).sort((a, b) => days(a.start!, a.end) - days(b.start!, b.end));
  for (const total of cumulative) {
    const prior = all.find((f) => f.start === total.start && f.end < end && days(f.end, end) >= 80 && days(f.end, end) <= 101);
    if (prior) {
      return { end, start: undefined, value: total.val - prior.val, accn: total.accn, form: total.form, filed: total.filed, concept, derived: true };
    }
  }
  return null;
}

// original=true 时每个期间取最早申报的数值（用于与原始年报核对）
export function quarterlySeries(factsByConcept: [concept: string, facts: Fact[]][], options: { additive?: boolean; original?: boolean } = {}): PeriodValue[] {
  const additive = options.additive ?? true;
  const original = options.original ?? false;
  const indexed = factsByConcept.map(([concept, facts]) => [concept, latestByPeriod(facts)] as const);
  const suspect = new Set<string>();
  for (const [, byPeriod] of indexed) for (const { latest } of byPeriod.values()) if (isLonger(latest)) suspect.add(`${latest.end}|${latest.val}`);
  const ends = new Set<string>();
  for (const [, byPeriod] of indexed) for (const { latest } of byPeriod.values()) if (isQuarter(latest) || isLonger(latest)) ends.add(latest.end);
  const out: PeriodValue[] = [];
  for (const end of [...ends].sort()) {
    // 逐期按候选顺序取第一个有值的科目
    for (const [concept, byPeriod] of indexed) {
      const v = pick(byPeriod, concept, end, suspect, additive, original);
      if (v) {
        out.push(v);
        break;
      }
    }
  }
  return out;
}

// original=true 时取每个财年最早申报的年报数值，用于与原始季报核对：
// 后来的年报常因会计准则调整重述以前年度（例如 2018 年新收入准则），与当年的季报口径不同
export function annualSeries(factsByConcept: [concept: string, facts: Fact[]][], options: { original?: boolean } = {}): PeriodValue[] {
  const out = new Map<string, PeriodValue>();
  for (const [concept, facts] of factsByConcept) {
    for (const { latest: newest, earliest, restatedFrom } of latestByPeriod(facts).values()) {
      const latest = options.original ? earliest : newest;
      if (!isAnnual(latest) || out.has(latest.end)) continue;
      out.set(latest.end, { end: latest.end, start: latest.start, value: latest.val, accn: latest.accn, form: latest.form, filed: latest.filed, concept, derived: false, restatedFrom: restatedFrom ? { value: restatedFrom.val, accn: restatedFrom.accn } : undefined });
    }
  }
  return [...out.values()].sort((a, b) => a.end.localeCompare(b.end));
}

export function instantSeries(factsByConcept: [concept: string, facts: Fact[]][]): PeriodValue[] {
  const out = new Map<string, PeriodValue>();
  for (const [concept, facts] of factsByConcept) {
    for (const { latest, restatedFrom } of latestByPeriod(facts.filter((f) => f.start === undefined)).values()) {
      if (out.has(latest.end)) continue;
      out.set(latest.end, { end: latest.end, value: latest.val, accn: latest.accn, form: latest.form, filed: latest.filed, concept, derived: false, restatedFrom: restatedFrom ? { value: restatedFrom.val, accn: restatedFrom.accn } : undefined });
    }
  }
  return [...out.values()].sort((a, b) => a.end.localeCompare(b.end));
}

// 四季合计与年报核对：返回不一致的财年（容差 1%）
export const FOUR_QUARTER_TOLERANCE = 0.01;

export function checkFourQuarters(quarters: PeriodValue[], annual: PeriodValue[]) {
  const problems: { end: string; annual: number; sum: number }[] = [];
  for (const fy of annual) {
    if (!fy.start) continue;
    const inYear = quarters.filter((q) => q.end > fy.start! && q.end <= fy.end);
    if (inYear.length !== 4) continue;
    const sum = inYear.reduce((a, q) => a + q.value, 0);
    if (Math.abs(sum - fy.value) > Math.abs(fy.value) * FOUR_QUARTER_TOLERANCE) problems.push({ end: fy.end, annual: fy.value, sum });
  }
  return problems;
}

// 口径一致地核对：最新季报对最新年报、原始季报对原始年报，任一组一致即通过。
// 只核对一组时，以前年度被重述（例如会计准则调整）会造成大量误报。
export function consistentMismatches(factsByConcept: [concept: string, facts: Fact[]][]) {
  const latest = checkFourQuarters(quarterlySeries(factsByConcept), annualSeries(factsByConcept));
  const original = new Set(checkFourQuarters(quarterlySeries(factsByConcept, { original: true }), annualSeries(factsByConcept, { original: true })).map((b) => b.end));
  return latest.filter((b) => original.has(b.end));
}

// 日历季度：以财季中点（截止日前 45 天）所在的日历季度为准，用于跨公司汇总
export function calendarQuarter(end: string): string {
  const mid = new Date(Date.parse(end) - 45 * 86_400_000);
  return `${mid.getUTCFullYear()}Q${Math.floor(mid.getUTCMonth() / 3) + 1}`;
}
