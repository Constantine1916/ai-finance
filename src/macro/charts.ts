// 宏观看板的图表登记表：接口只接受这里登记的图表编号

export type Transform = "level" | "yoy" | "ann3m" | "ma4" | "avg3diff";
export type Range = "1y" | "3y" | "5y" | "10y" | "max";
export const RANGES: Range[] = ["1y", "3y", "5y", "10y", "max"];
export const RANGE_LABEL: Record<Range, string> = { "1y": "1 年", "3y": "3 年", "5y": "5 年", "10y": "10 年", max: "全部" };

export type LineSpec =
  | { label: string; series: string; transform?: Transform } // 观测序列
  | { label: string; derived: string } // derived_values 中的派生序列
  | { label: string; series: string; newer: string }; // 主序列 + 更早发布来源补上最新日期（如 FRED + 财政部）

export type Annotation =
  | { kind: "threshold"; value: number; label: string }
  | { kind: "shade-below"; value: number; label: string } // 例如利差倒挂
  | { kind: "shade-above"; value: number; label: string }; // 例如 VIX/VIX3M > 1

export interface ChartSpec {
  id: string;
  title: string;
  unit: string; // 图上显示的单位
  lines: LineSpec[];
  annotations?: Annotation[];
  defaultRange?: Range;
  note?: string; // 计算方式、替代指标等说明
}

const yoyAnd3m = (id: string, series: string, title: string): ChartSpec => ({
  id,
  title,
  unit: "%",
  lines: [
    { label: "同比", series, transform: "yoy" },
    { label: "3 个月年化", series, transform: "ann3m" },
  ],
  annotations: [{ kind: "threshold", value: 2, label: "2%" }],
  defaultRange: "10y",
  note: "同比 = 当月 / 12 个月前 − 1；3 个月年化 = (当月 / 3 个月前)^4 − 1。",
});

export const SECTIONS: { id: string; title: string; charts: ChartSpec[] }[] = [
  {
    id: "rates",
    title: "利率",
    charts: [
      {
        id: "yields",
        title: "国债收益率",
        unit: "%",
        lines: [
          { label: "3 个月", series: "fred:DGS3MO", newer: "treasury:3MO" },
          { label: "2 年", series: "fred:DGS2", newer: "treasury:2Y" },
          { label: "10 年", series: "fred:DGS10", newer: "treasury:10Y" },
          { label: "30 年", series: "fred:DGS30", newer: "treasury:30Y" },
        ],
        note: "历史来自 FRED；FRED 尚未更新的最新交易日取自财政部当日公布值。",
      },
      {
        id: "spreads",
        title: "期限利差",
        unit: "百分点",
        lines: [
          { label: "10Y − 3M", series: "fred:T10Y3M" },
          { label: "10Y − 2Y", series: "fred:T10Y2Y" },
        ],
        annotations: [{ kind: "shade-below", value: 0, label: "10Y − 3M 倒挂" }],
        defaultRange: "10y",
      },
      {
        id: "real",
        title: "10 年期实际利率与通胀预期",
        unit: "%",
        lines: [
          { label: "实际利率（TIPS）", series: "fred:DFII10" },
          { label: "通胀预期（盈亏平衡）", series: "fred:T10YIE" },
        ],
        note: "名义 10 年期收益率 ≈ 实际利率 + 通胀预期。",
      },
      { id: "term-premium", title: "10 年期限溢价（Kim-Wright）", unit: "%", lines: [{ label: "期限溢价", series: "fred:THREEFYTP10" }], annotations: [{ kind: "threshold", value: 0, label: "0" }], defaultRange: "10y" },
      { id: "fed-funds", title: "联邦基金有效利率", unit: "%", lines: [{ label: "联邦基金利率", series: "fred:DFF" }], defaultRange: "10y" },
    ],
  },
  {
    id: "inflation",
    title: "通胀与商品",
    charts: [
      yoyAnd3m("cpi", "fred:CPIAUCSL", "CPI"),
      yoyAnd3m("core-cpi", "fred:CPILFESL", "核心 CPI"),
      yoyAnd3m("core-pce", "fred:PCEPILFE", "核心 PCE 价格指数"),
      { id: "5y5y", title: "5 年后 5 年通胀预期", unit: "%", lines: [{ label: "5Y5Y", series: "fred:T5YIFR" }], defaultRange: "10y" },
      {
        id: "oil",
        title: "原油价格",
        unit: "美元/桶",
        lines: [
          { label: "WTI", series: "fred:DCOILWTICO" },
          { label: "布伦特", series: "fred:DCOILBRENTEU" },
        ],
      },
      { id: "dollar", title: "美元广义指数", unit: "指数（2006-01 = 100）", lines: [{ label: "美元指数", series: "fred:DTWEXBGS" }] },
      { id: "electricity", title: "美国平均电价", unit: "美元/千瓦时", lines: [{ label: "电价", series: "fred:APU000072610" }], defaultRange: "10y" },
    ],
  },
  {
    id: "credit",
    title: "信用",
    charts: [
      {
        id: "oas",
        title: "信用利差（期权调整）",
        unit: "百分点",
        lines: [
          { label: "高收益债", series: "fred:BAMLH0A0HYM2" },
          { label: "投资级", series: "fred:BAMLC0A0CM" },
        ],
        defaultRange: "max",
        note: "ICE BofA 数据经 FRED 只提供最近 3 年；更长历史见下方 ETF 替代指标。",
      },
      {
        id: "hyg-ief",
        title: "HYG / IEF 价格比（替代指标）",
        unit: "比值",
        lines: [{ label: "HYG / IEF", derived: "ratio:HYG/IEF" }],
        defaultRange: "max",
        note: "高收益债 ETF 与中期国债 ETF 复权价之比，用于观察信用风险偏好的长期走势；不是利差本身，比值下降对应信用偏紧。",
      },
    ],
  },
  {
    id: "growth",
    title: "增长与就业",
    charts: [
      { id: "sahm", title: "萨姆规则（实时）", unit: "百分点", lines: [{ label: "萨姆规则", series: "fred:SAHMREALTIME" }], annotations: [{ kind: "threshold", value: 0.5, label: "衰退触发 0.5" }], defaultRange: "max" },
      { id: "unrate", title: "失业率", unit: "%", lines: [{ label: "失业率", series: "fred:UNRATE" }], defaultRange: "10y" },
      { id: "claims", title: "初请失业金（4 周均值）", unit: "人", lines: [{ label: "4 周均值", series: "fred:ICSA", transform: "ma4" }], note: "周度数据的 4 周移动平均。" },
      { id: "payrolls", title: "非农就业：3 个月平均新增", unit: "千人", lines: [{ label: "3 个月平均", series: "fred:PAYEMS", transform: "avg3diff" }], annotations: [{ kind: "threshold", value: 0, label: "0" }], note: "每月新增就业人数的 3 个月平均。" },
      { id: "indpro", title: "工业产出同比", unit: "%", lines: [{ label: "工业产出", series: "fred:INDPRO", transform: "yoy" }], annotations: [{ kind: "threshold", value: 0, label: "0" }], defaultRange: "10y" },
      {
        id: "philly",
        title: "费城联储制造业调查",
        unit: "扩散指数",
        lines: [
          { label: "总体", series: "fred:GACDFSA066MSFRBPHI" },
          { label: "新订单", series: "fred:NOCDFSA066MSFRBPHI" },
        ],
        annotations: [{ kind: "threshold", value: 0, label: "扩张 / 收缩分界" }],
        note: "ISM 制造业 PMI 不免费，以费城联储调查代替。",
      },
    ],
  },
  {
    id: "liquidity",
    title: "流动性与金融条件",
    charts: [
      {
        id: "net-liquidity",
        title: "净流动性",
        unit: "十亿美元",
        lines: [{ label: "净流动性", derived: "net-liquidity" }],
        note: "净流动性 = 美联储总资产 − 财政部一般账户 − 隔夜逆回购，按美联储周三数据对齐；逆回购取 7 天内最近一日。这是市场常用的经验性指标，不是因果规律。",
      },
      { id: "nfci", title: "芝加哥联储金融条件指数", unit: "指数", lines: [{ label: "NFCI", series: "fred:NFCI" }], annotations: [{ kind: "threshold", value: 0, label: "高于 0 偏紧" }], defaultRange: "10y" },
      { id: "fed-assets", title: "美联储总资产", unit: "百万美元", lines: [{ label: "总资产", series: "fred:WALCL" }], defaultRange: "max" },
      { id: "tga", title: "财政部一般账户", unit: "百万美元", lines: [{ label: "TGA", series: "fred:WTREGEN" }] },
      { id: "rrp", title: "隔夜逆回购余额", unit: "十亿美元", lines: [{ label: "逆回购", series: "fred:RRPONTSYD" }] },
    ],
  },
  {
    id: "market",
    title: "大盘与市场宽度",
    charts: [
      {
        id: "spy-trend",
        title: "SPY 与 200 日均线",
        unit: "美元（复权）",
        lines: [
          { label: "SPY", derived: "adj:SPY" },
          { label: "200 日均线", derived: "sma200:SPY" },
        ],
        defaultRange: "3y",
      },
      {
        id: "soxx-trend",
        title: "SOXX（半导体）与 200 日均线",
        unit: "美元（复权）",
        lines: [
          { label: "SOXX", derived: "adj:SOXX" },
          { label: "200 日均线", derived: "sma200:SOXX" },
        ],
        defaultRange: "3y",
        note: "费城半导体指数没有免费数据，以 SOXX ETF 代替。",
      },
      {
        id: "breadth",
        title: "相对强弱",
        unit: "比值（期初 = 100）",
        lines: [
          { label: "IWM / SPY（小盘相对大盘）", derived: "ratio:IWM/SPY" },
          { label: "RSP / SPY（等权相对市值加权）", derived: "ratio:RSP/SPY" },
          { label: "SOXX / SPY（半导体相对大盘）", derived: "ratio:SOXX/SPY" },
        ],
        note: "三个比值在所选区间的第一天都换算为 100，便于比较方向。IWM 代替罗素 2000 指数。",
      },
      { id: "vix", title: "VIX", unit: "指数", lines: [{ label: "VIX", series: "fred:VIXCLS" }], annotations: [{ kind: "threshold", value: 25, label: "25" }], defaultRange: "3y" },
      { id: "vix-term", title: "VIX / VIX3M 期限结构", unit: "比值", lines: [{ label: "VIX / VIX3M", derived: "ratio:VIX/VIX3M" }], annotations: [{ kind: "shade-above", value: 1, label: "倒挂（短期恐慌）" }], defaultRange: "3y" },
      {
        id: "indices",
        title: "主要指数",
        unit: "指数（期初 = 100）",
        lines: [
          { label: "标普 500", series: "fred:SP500" },
          { label: "纳斯达克 100", series: "fred:NASDAQ100" },
          { label: "纳斯达克综合", series: "fred:NASDAQCOM" },
        ],
        note: "三个指数在所选区间的第一天都换算为 100。标普 500 经 FRED 只提供最近 10 年。",
      },
    ],
  },
];

// 需要换算为“期初 = 100”的图表
export const INDEXED_CHARTS = new Set(["breadth", "indices"]);

export const CHARTS = new Map(SECTIONS.flatMap((s) => s.charts.map((c) => [c.id, c] as const)));
