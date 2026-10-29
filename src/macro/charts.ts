// 宏观看板的图表登记表：接口只接受这里登记的图表编号

export type Transform = "level" | "yoy" | "ann3m" | "ma4" | "avg3diff";
export type Range = "1y" | "3y" | "5y" | "10y" | "max";
export const RANGES: Range[] = ["1y", "3y", "5y", "10y", "max"];
export const RANGE_LABEL: Record<Range, string> = { "1y": "1 年", "3y": "3 年", "5y": "5 年", "10y": "10 年", max: "全部" };

export type Formula = "grossMargin" | "opMargin" | "inventoryDays" | "revenueYoY";

export type LineSpec =
  | { label: string; series: string; transform?: Transform; scale?: number } // 观测序列；scale 为显示时的除数
  | { label: string; derived: string; scale?: number } // derived_values 中的派生序列
  | { label: string; series: string; newer: string } // 主序列 + 更早发布来源补上最新日期（如 FRED + 财政部）
  | { label: string; formula: Formula; symbol: string; annual?: boolean }; // 由财报序列计算的比率

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

// 1B：AI 产业周期页的图表
export const AI_CHARTS: ChartSpec[] = [
  {
    id: "ai-capex",
    title: "云厂商资本开支合计",
    unit: "十亿美元",
    lines: [{ label: "合计（完整季度）", derived: "capex:hyperscalers", scale: 1e9 }],
    defaultRange: "10y",
    note: "微软、谷歌、亚马逊、Meta、甲骨文等计入汇总的公司按财季中点归入日历季度后相加（微软财年 6 月结束、甲骨文 5 月结束）；任一公司尚未申报的季度不计入。成员可在下方关注池中调整。",
  },
  {
    id: "ai-capex-yoy",
    title: "云厂商资本开支合计同比",
    unit: "%",
    lines: [{ label: "同比", derived: "capex:hyperscalers:yoy" }],
    annotations: [{ kind: "threshold", value: 0, label: "0" }],
    defaultRange: "10y",
    note: "需求端最关键的指标：关注的是增速的变化，增速连续下降往往先于绝对值下降。",
  },
  {
    id: "ai-cloud-growth",
    title: "云业务收入同比增速（人工录入）",
    unit: "%",
    lines: [
      { label: "Azure", series: "manual:cloud-growth-AZURE" },
      { label: "谷歌云", series: "manual:cloud-growth-GCP" },
      { label: "AWS", series: "manual:cloud-growth-AWS" },
    ],
    defaultRange: "5y",
    note: "分部收入不在结构化财务数据中，来自财报电话会或新闻稿，在数据健康页录入。资本开支持续增长而云收入跟不上，资本开支迟早会被削减。",
  },
  { id: "ai-tsmc", title: "台积电月营收", unit: "十亿新台币", lines: [{ label: "月营收", series: "tsmc:revenue", scale: 1e3 }], defaultRange: "5y", note: "取自台积电每月向 SEC 报送的营收 6-K，后一份报告的上月与去年同月数值用于核对。" },
  { id: "ai-tsmc-yoy", title: "台积电月营收：3 个月平均同比", unit: "%", lines: [{ label: "3 个月平均同比", derived: "tsmc:revenue:3m-yoy" }], annotations: [{ kind: "threshold", value: 0, label: "0" }], defaultRange: "5y" },
  {
    id: "ai-korea",
    title: "韩国半导体出口（人工录入）",
    unit: "十亿美元",
    lines: [
      { label: "全月", series: "manual:kr-semis-exports" },
      { label: "当月前 20 天", series: "manual:kr-semis-exports-20d" },
    ],
    defaultRange: "3y",
    note: "韩国关税厅每月 1 日公布上月全月、21 日公布当月前 20 天数据；两者分开记录，不混为同一序列。",
  },
  { id: "ai-semis-ip", title: "美国半导体与电子元件工业产出同比", unit: "%", lines: [{ label: "同比", series: "fred:IPG3344S", transform: "yoy" }], annotations: [{ kind: "threshold", value: 0, label: "0" }], defaultRange: "10y" },
  {
    id: "ai-dram",
    title: "DRAM 价格（人工录入）",
    unit: "美元",
    lines: [
      { label: "合约价", series: "manual:dram-contract" },
      { label: "现货价", series: "manual:dram-spot" },
    ],
    defaultRange: "3y",
    note: "来自 TrendForce、DRAMeXchange 等公开报告。现货价通常先于合约价掉头。",
  },
  { id: "ai-mu-capex-guide", title: "美光当财年资本开支指引（人工录入）", unit: "十亿美元", lines: [{ label: "指引", series: "manual:capex-guide-MU" }], defaultRange: "5y", note: "存储厂大幅上调资本开支、宣布新厂，常是周期见顶的信号之一。" },
];

// 需要换算为“期初 = 100”的图表
export const INDEXED_CHARTS = new Set(["breadth", "indices"]);

export const CHARTS = new Map([...SECTIONS.flatMap((s) => s.charts), ...AI_CHARTS].map((c) => [c.id, c] as const));

// 个股图表：按代码动态生成，编号形如 stock:NVDA:margins
export const STOCK_CHART_KINDS = ["price", "revenue", "margins", "inventory", "capex", "pe", "pb"] as const;
export type StockChartKind = (typeof STOCK_CHART_KINDS)[number];

export function stockChartSpec(symbol: string, kind: StockChartKind, annual: boolean, currency: string): ChartSpec {
  const id = `stock:${symbol}:${kind}`;
  const sfx = annual ? ":fy" : "";
  const money = currency === "USD" ? "十亿美元" : `十亿 ${currency}`;
  const period = annual ? "年度" : "单季";
  switch (kind) {
    case "price":
      return { id, title: `${symbol} 复权价与 200 日均线`, unit: "美元", lines: [{ label: symbol, derived: `adj:${symbol}` }, { label: "200 日均线", derived: `sma200:${symbol}` }], defaultRange: "3y" };
    case "revenue":
      return {
        id,
        title: `营收（${period}）与同比`,
        unit: `${money}；同比为 %`,
        lines: [{ label: `营收（${money}）`, series: `edgar:${symbol}:revenue${sfx}`, scale: 1e9 }, { label: "同比 %", formula: "revenueYoY", symbol, annual }],
        defaultRange: "10y",
        note: "营收与同比单位不同，共用一个纵轴只为对照时间位置；数值以悬停提示与表格为准。",
      };
    case "margins":
      return {
        id,
        title: `毛利率与营业利润率（${period}）`,
        unit: "%",
        lines: [{ label: "毛利率", formula: "grossMargin", symbol, annual }, { label: "营业利润率", formula: "opMargin", symbol, annual }],
        defaultRange: "10y",
        note: "公司未申报毛利时以营收减营业成本计算；未申报营业利润时该线为空。",
      };
    case "inventory":
      return { id, title: "存货天数", unit: "天", lines: [{ label: "存货天数", formula: "inventoryDays", symbol, annual }], defaultRange: "10y", note: `存货天数 = 期末存货 / ${annual ? "全年营业成本 × 365" : "单季营业成本 × 91"}。半导体周期见顶时常见增速放缓与存货堆积。` };
    case "capex":
      return { id, title: `资本开支（${period}）`, unit: money, lines: [{ label: "资本开支", series: `edgar:${symbol}:capex${sfx}`, scale: 1e9 }], defaultRange: "10y" };
    case "pe":
      return { id, title: "滚动 12 个月市盈率", unit: "倍", lines: [{ label: "市盈率", derived: `pe:${symbol}` }], defaultRange: "10y", note: "市值 / 最近四季净利润合计；财报在期末 60 天后才计入。亏损期间为空。周期股在盈利高峰时市盈率最低，不宜据此判断贵贱。" };
    case "pb":
      return { id, title: "市净率", unit: "倍", lines: [{ label: "市净率", derived: `pb:${symbol}` }], defaultRange: "10y", note: "市值 / 期末股东权益；财报在期末 60 天后才计入。" };
  }
}
