import { addDays } from "@/pipeline/calendar";
import { sma, type Point } from "@/pipeline/derived";

// 信号规则（版本化）。每条规则对全部历史逐日给出状态，当前状态与历史触发使用同一套计算。

export type State = "normal" | "watch" | "warning";
export type ParamValues = Record<string, number>;

export interface InputRef {
  key: string;
  series?: string; // 观测序列
  derived?: string; // 派生序列
}

export interface DailyState {
  date: string;
  value: number;
  state: State;
}

export interface RuleDef {
  id: string;
  name: string;
  version: number;
  inputs: InputRef[];
  provenance: string[]; // 用于时效与来源显示的原始序列
  revisedInputs: boolean; // 输入会被事后修订：历史回看存在前视偏差
  priceBased: boolean; // 交易时段可用盘中快照计算暂定状态
  unit: string;
  params: Record<string, { label: string; default: number; unit: string }>;
  describe(p: ParamValues): { warning: string; watch: string };
  evaluate(data: Record<string, Point[]>, p: ParamValues): DailyState[];
}

const valid = (points: Point[]) => points.filter((x): x is { date: string; value: number } => x.value !== null);

// 每个日期与约 N 个交易日前的变化
function changeOver(points: Point[], tradingDays: number) {
  const v = valid(points);
  return v.slice(tradingDays).map((p, i) => ({ date: p.date, value: p.value, change: p.value - v[i]!.value }));
}

const level = (value: number, warning: number, watch: number, above = true): State =>
  above ? (value > warning ? "warning" : value > watch ? "watch" : "normal") : value < warning ? "warning" : value < watch ? "watch" : "normal";

export const RULES: RuleDef[] = [
  {
    id: "curve-uninversion",
    name: "10Y − 3M 利差倒挂后转正",
    version: 1,
    inputs: [{ key: "spread", series: "fred:T10Y3M" }],
    provenance: ["fred:T10Y3M"],
    revisedInputs: false,
    priceBased: false,
    unit: "百分点",
    params: {
      minInvertedDays: { label: "一轮倒挂中至少有", default: 60, unit: "个交易日低于 0" },
      confirmDays: { label: "转正需连续保持", default: 20, unit: "个交易日" },
      warnMonths: { label: "转正后警示持续", default: 12, unit: "个月" },
    },
    describe: (p) => ({
      warning: `一轮倒挂（期间至少 ${p.minInvertedDays} 个交易日低于 0）结束：利差连续 ${p.confirmDays} 个交易日不低于 0 时确认转正，之后 ${p.warnMonths} 个月内保持警示（历史上衰退常出现在转正之后）`,
      watch: "处于一轮倒挂中（利差低于 0，或转正尚未得到确认）",
    }),
    evaluate(data, p) {
      // 一轮倒挂在利差连续 confirmDays 天不低于 0 时才算结束；期间短暂转正不会把倒挂天数清零。
      // 转正在第 confirmDays 天确认，判断只用当天及之前的数据。
      const out: DailyState[] = [];
      let inEpisode = false;
      let invertedDays = 0;
      let positiveRun = 0;
      let uninvertedAt: string | null = null;
      for (const pt of valid(data.spread ?? [])) {
        if (pt.value < 0) {
          inEpisode = true;
          invertedDays++;
          positiveRun = 0;
        } else if (inEpisode && ++positiveRun >= p.confirmDays!) {
          if (invertedDays >= p.minInvertedDays!) uninvertedAt = pt.date;
          inEpisode = false;
          invertedDays = 0;
        }
        const warn = !inEpisode && uninvertedAt !== null && pt.date <= addDays(uninvertedAt, Math.round(p.warnMonths! * 30.44));
        out.push({ date: pt.date, value: pt.value, state: inEpisode ? "watch" : warn ? "warning" : "normal" });
      }
      return out;
    },
  },
  {
    id: "hy-spread-widening",
    name: "高收益债利差快速走阔",
    version: 1,
    inputs: [{ key: "oas", series: "fred:BAMLH0A0HYM2" }],
    provenance: ["fred:BAMLH0A0HYM2"],
    revisedInputs: false,
    priceBased: false,
    unit: "百分点（3 个月变化）",
    params: {
      warning: { label: "3 个月内上升超过", default: 1, unit: "个百分点" },
      watch: { label: "关注阈值", default: 0.5, unit: "个百分点" },
    },
    describe: (p) => ({ warning: `高收益债利差 3 个月（63 个交易日）内上升超过 ${p.warning} 个百分点`, watch: `3 个月内上升超过 ${p.watch} 个百分点` }),
    evaluate: (data, p) => changeOver(data.oas ?? [], 63).map((x) => ({ date: x.date, value: x.change, state: level(x.change, p.warning!, p.watch!) })),
  },
  {
    id: "sahm",
    name: "萨姆规则",
    version: 1,
    inputs: [{ key: "sahm", series: "fred:SAHMREALTIME" }],
    provenance: ["fred:SAHMREALTIME"],
    revisedInputs: false, // 实时版本按当时公布的失业率计算
    priceBased: false,
    unit: "百分点",
    params: { warning: { label: "警示阈值", default: 0.5, unit: "百分点" }, watch: { label: "关注阈值", default: 0.3, unit: "百分点" } },
    describe: (p) => ({ warning: `萨姆规则读数 ≥ ${p.warning}`, watch: `读数 ≥ ${p.watch}` }),
    evaluate: (data, p) =>
      valid(data.sahm ?? []).map((x) => ({ date: x.date, value: x.value, state: x.value >= p.warning! ? "warning" : x.value >= p.watch! ? "watch" : "normal" })),
  },
  {
    id: "claims-rise",
    name: "初请失业金上升",
    version: 1,
    inputs: [{ key: "claims", series: "fred:ICSA" }],
    provenance: ["fred:ICSA"],
    revisedInputs: true,
    priceBased: false,
    unit: "%（4 周均值较 52 周低点）",
    params: { warning: { label: "较 52 周低点上升超过", default: 20, unit: "%" }, watch: { label: "关注阈值", default: 10, unit: "%" } },
    describe: (p) => ({ warning: `初请失业金 4 周均值较过去 52 周最低值上升超过 ${p.warning}%`, watch: `上升超过 ${p.watch}%` }),
    evaluate(data, p) {
      const ma = valid(sma(data.claims ?? [], 4));
      return ma.slice(51).map((x, i) => {
        const low = Math.min(...ma.slice(i, i + 52).map((m) => m.value));
        const rise = (x.value / low - 1) * 100;
        return { date: x.date, value: rise, state: level(rise, p.warning!, p.watch!) };
      });
    },
  },
  {
    id: "nfci",
    name: "金融条件收紧",
    version: 1,
    inputs: [{ key: "nfci", series: "fred:NFCI" }],
    provenance: ["fred:NFCI"],
    revisedInputs: true,
    priceBased: false,
    unit: "指数",
    params: { warning: { label: "警示阈值（高于）", default: 0, unit: "" }, watch: { label: "关注阈值（高于）", default: -0.25, unit: "" } },
    describe: (p) => ({ warning: `芝加哥联储金融条件指数高于 ${p.warning}（偏紧于历史平均）`, watch: `高于 ${p.watch}` }),
    evaluate: (data, p) => valid(data.nfci ?? []).map((x) => ({ date: x.date, value: x.value, state: level(x.value, p.warning!, p.watch!) })),
  },
  {
    id: "spy-200dma",
    name: "SPY 跌破 200 日均线",
    version: 1,
    inputs: [
      { key: "price", derived: "adj:SPY" },
      { key: "ma", derived: "sma200:SPY" },
    ],
    provenance: ["tiingo:SPY:close"],
    revisedInputs: false,
    priceBased: true,
    unit: "%（相对 200 日均线）",
    params: { watch: { label: "高于均线不足", default: 2, unit: "%" } },
    describe: (p) => ({ warning: "SPY 复权收盘价低于 200 日均线", watch: `高于 200 日均线不足 ${p.watch}%` }),
    evaluate(data, p) {
      const ma = new Map(valid(data.ma ?? []).map((m) => [m.date, m.value]));
      return valid(data.price ?? [])
        .filter((x) => ma.has(x.date))
        .map((x) => {
          const gap = (x.value / ma.get(x.date)! - 1) * 100;
          return { date: x.date, value: gap, state: gap < 0 ? "warning" : gap < p.watch! ? "watch" : "normal" };
        });
    },
  },
  {
    id: "vix-term",
    name: "VIX 期限结构倒挂",
    version: 1,
    inputs: [{ key: "ratio", derived: "ratio:VIX/VIX3M" }],
    provenance: ["fred:VIXCLS", "fred:VXVCLS"],
    revisedInputs: false,
    priceBased: false,
    unit: "比值",
    params: { warning: { label: "警示阈值（高于）", default: 1, unit: "" }, watch: { label: "关注阈值（高于）", default: 0.95, unit: "" } },
    describe: (p) => ({ warning: `VIX / VIX3M 高于 ${p.warning}（短期恐慌高于中期）`, watch: `高于 ${p.watch}` }),
    evaluate: (data, p) => valid(data.ratio ?? []).map((x) => ({ date: x.date, value: x.value, state: level(x.value, p.warning!, p.watch!) })),
  },
  {
    id: "oil-shock",
    name: "原油价格冲击",
    version: 1,
    inputs: [{ key: "wti", series: "fred:DCOILWTICO" }],
    provenance: ["fred:DCOILWTICO"],
    revisedInputs: false,
    priceBased: false,
    unit: "%（同比）",
    params: { warning: { label: "同比上涨超过", default: 50, unit: "%" }, watch: { label: "关注阈值", default: 30, unit: "%" } },
    describe: (p) => ({ warning: `WTI 原油价格同比上涨超过 ${p.warning}%`, watch: `同比上涨超过 ${p.watch}%` }),
    evaluate(data, p) {
      const v = valid(data.wti ?? []);
      const out: DailyState[] = [];
      let j = 0;
      for (const x of v) {
        const target = addDays(x.date, -365);
        while (j + 1 < v.length && v[j + 1]!.date <= target) j++;
        const base = v[j]!;
        // 一年前没有足够接近的数据（相差超过 7 天）或价格非正时不计算
        if (base.date > target || Date.parse(target) - Date.parse(base.date) > 7 * 86_400_000 || base.value <= 0) continue;
        const yoy = (x.value / base.value - 1) * 100;
        out.push({ date: x.date, value: yoy, state: level(yoy, p.warning!, p.watch!) });
      }
      return out;
    },
  },
  {
    id: "real-rate-jump",
    name: "实际利率快速上升",
    version: 1,
    inputs: [{ key: "real", series: "fred:DFII10" }],
    provenance: ["fred:DFII10"],
    revisedInputs: false,
    priceBased: false,
    unit: "百分点（3 个月变化）",
    params: { warning: { label: "3 个月内上升超过", default: 0.75, unit: "个百分点" }, watch: { label: "关注阈值", default: 0.5, unit: "个百分点" } },
    describe: (p) => ({ warning: `10 年期实际利率 3 个月（63 个交易日）内上升超过 ${p.warning} 个百分点`, watch: `上升超过 ${p.watch} 个百分点` }),
    evaluate: (data, p) => changeOver(data.real ?? [], 63).map((x) => ({ date: x.date, value: x.change, state: level(x.change, p.warning!, p.watch!) })),
  },
  {
    id: "capex-slowdown",
    name: "云厂商资本开支增速放缓",
    version: 1,
    inputs: [{ key: "yoy", derived: "capex:hyperscalers:yoy" }],
    provenance: ["edgar:MSFT:capex", "edgar:GOOGL:capex", "edgar:AMZN:capex", "edgar:META:capex", "edgar:ORCL:capex"],
    revisedInputs: true,
    priceBased: false,
    unit: "%（合计同比）",
    params: { quarters: { label: "同比增速连续下降", default: 2, unit: "个季度" } },
    describe: (p) => ({
      warning: `云厂商资本开支合计（只计各成员都已申报的季度）同比增速连续 ${p.quarters} 个季度下降（AI 硬件需求的增速见顶信号）`,
      watch: "同比增速较上一季度下降",
    }),
    evaluate(data, p) {
      const v = valid(data.yoy ?? []);
      return v.map((x, i) => {
        let falling = 0;
        for (let j = i; j > 0 && v[j]!.value < v[j - 1]!.value; j--) falling++;
        return { date: x.date, value: x.value, state: falling >= p.quarters! ? "warning" : falling >= 1 ? "watch" : "normal" };
      });
    },
  },
  {
    id: "tsmc-revenue",
    name: "台积电月营收转弱",
    version: 1,
    inputs: [{ key: "yoy", derived: "tsmc:revenue:3m-yoy" }],
    provenance: ["tsmc:revenue"],
    revisedInputs: false,
    priceBased: false,
    unit: "%（3 个月平均同比）",
    params: { warning: { label: "警示阈值（低于）", default: 0, unit: "%" }, watch: { label: "关注阈值（低于）", default: 10, unit: "%" } },
    describe: (p) => ({ warning: `台积电最近 3 个月营收合计同比低于 ${p.warning}%`, watch: `低于 ${p.watch}%` }),
    evaluate: (data, p) => valid(data.yoy ?? []).map((x) => ({ date: x.date, value: x.value, state: level(x.value, p.warning!, p.watch!, false) })),
  },
];

export const RULE_MAP = new Map(RULES.map((r) => [r.id, r]));

export function defaultParams(rule: RuleDef): ParamValues {
  return Object.fromEntries(Object.entries(rule.params).map(([k, v]) => [k, v.default]));
}

// 进入警示的日期；两次触发至少间隔 cooldownDays，避免在阈值附近来回波动时重复计数
export function triggerDates(states: DailyState[], cooldownDays = 90): string[] {
  const out: string[] = [];
  for (let i = 0; i < states.length; i++) {
    const s = states[i]!;
    if (s.state !== "warning" || states[i - 1]?.state === "warning") continue;
    const last = out.at(-1);
    if (last && s.date < addDays(last, cooldownDays)) continue;
    out.push(s.date);
  }
  return out;
}
