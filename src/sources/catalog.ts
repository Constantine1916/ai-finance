import type { Frequency, SeriesDef, TradingCalendar } from "@/pipeline/types";

// 1A 登记的序列。单位、频率与季调取自各来源的元数据（2026-10-27 核对）。

const PERCENT_RANGE = { validMin: -5, validMax: 25 };

function fred(
  key: string,
  nameZh: string,
  unit: string,
  frequency: Frequency,
  category: string,
  extra: Partial<SeriesDef> = {},
): SeriesDef {
  const calendar: TradingCalendar | undefined = frequency === "daily" ? "weekdays" : undefined;
  return { id: `fred:${key}`, source: "fred", sourceKey: key, nameZh, unit, frequency, category, calendar, ...extra };
}

const daily = (lag: number) => ({ releaseLagDays: lag, jumpSigma: 8 });

export const FRED_SERIES: SeriesDef[] = [
  // 利率
  fred("DGS3MO", "3 个月期国债收益率", "Percent", "daily", "rates", { ...PERCENT_RANGE, ...daily(1) }),
  fred("DGS2", "2 年期国债收益率", "Percent", "daily", "rates", { ...PERCENT_RANGE, ...daily(1) }),
  fred("DGS5", "5 年期国债收益率", "Percent", "daily", "rates", { ...PERCENT_RANGE, ...daily(1) }),
  fred("DGS10", "10 年期国债收益率", "Percent", "daily", "rates", { ...PERCENT_RANGE, ...daily(1) }),
  fred("DGS20", "20 年期国债收益率", "Percent", "daily", "rates", { ...PERCENT_RANGE, ...daily(1) }),
  fred("DGS30", "30 年期国债收益率", "Percent", "daily", "rates", { ...PERCENT_RANGE, ...daily(1) }),
  fred("T10Y2Y", "10 年减 2 年期限利差", "Percent", "daily", "rates", { validMin: -5, validMax: 5, ...daily(1) }),
  fred("T10Y3M", "10 年减 3 个月期限利差", "Percent", "daily", "rates", { validMin: -6, validMax: 6, ...daily(1) }),
  fred("DFII10", "10 年期实际利率（TIPS）", "Percent", "daily", "rates", { validMin: -5, validMax: 10, ...daily(1) }),
  fred("T10YIE", "10 年期通胀预期（盈亏平衡）", "Percent", "daily", "inflation", { validMin: -3, validMax: 10, ...daily(1) }),
  fred("T5YIFR", "5 年后 5 年通胀预期", "Percent", "daily", "inflation", { validMin: -3, validMax: 10, ...daily(1) }),
  fred("THREEFYTP10", "10 年期限溢价（Kim-Wright）", "Percent", "daily", "rates", { validMin: -5, validMax: 6, releaseLagDays: 10 }),
  fred("DFF", "联邦基金有效利率", "Percent", "daily", "rates", { validMin: 0, validMax: 25, releaseLagDays: 1 }),
  // 通胀与商品
  fred("CPIAUCSL", "CPI", "Index 1982-1984=100", "monthly", "inflation", { seasonalAdjustment: "SA", validMin: 0, validMax: 2000, releaseLagDays: 15 }),
  fred("CPILFESL", "核心 CPI", "Index 1982-1984=100", "monthly", "inflation", { seasonalAdjustment: "SA", validMin: 0, validMax: 2000, releaseLagDays: 15 }),
  fred("PCEPILFE", "核心 PCE 价格指数", "Index 2017=100", "monthly", "inflation", { seasonalAdjustment: "SA", validMin: 0, validMax: 1000, releaseLagDays: 31 }),
  fred("DCOILWTICO", "WTI 原油", "Dollars per Barrel", "daily", "commodities", { validMin: -50, validMax: 400, releaseLagDays: 7, calendar: "weekdays" }),
  fred("DCOILBRENTEU", "布伦特原油", "Dollars per Barrel", "daily", "commodities", { validMin: 0, validMax: 400, releaseLagDays: 7, calendar: "weekdays" }),
  fred("DTWEXBGS", "美元广义指数", "Index Jan 2006=100", "daily", "commodities", { validMin: 50, validMax: 250, releaseLagDays: 7 }),
  fred("APU000072610", "美国平均电价", "U.S. Dollars", "monthly", "commodities", { validMin: 0, validMax: 2, releaseLagDays: 15 }),
  // 信用
  fred("BAMLH0A0HYM2", "高收益债期权调整利差", "Percent", "daily", "credit", { copyrightHolder: "ICE Data Indices", validMin: 0, validMax: 30, ...daily(1) }),
  fred("BAMLC0A0CM", "投资级债期权调整利差", "Percent", "daily", "credit", { copyrightHolder: "ICE Data Indices", validMin: 0, validMax: 10, ...daily(1) }),
  // 就业与增长
  fred("UNRATE", "失业率", "Percent", "monthly", "growth", { seasonalAdjustment: "SA", validMin: 0, validMax: 30, releaseLagDays: 8 }),
  fred("SAHMREALTIME", "萨姆规则（实时）", "Percentage Points", "monthly", "growth", { seasonalAdjustment: "SA", validMin: -2, validMax: 10, releaseLagDays: 8 }),
  fred("ICSA", "初请失业金人数", "Number", "weekly", "growth", { seasonalAdjustment: "SA", validMin: 0, validMax: 10_000_000, releaseLagDays: 5 }),
  fred("PAYEMS", "非农就业人数", "Thousands of Persons", "monthly", "growth", { seasonalAdjustment: "SA", validMin: 0, validMax: 300_000, releaseLagDays: 8 }),
  fred("INDPRO", "工业产出", "Index 2017=100", "monthly", "growth", { seasonalAdjustment: "SA", validMin: 0, validMax: 300, releaseLagDays: 17 }),
  fred("IPG3344S", "半导体与电子元件工业产出", "Index 2017=100", "monthly", "growth", { seasonalAdjustment: "SA", validMin: 0, validMax: 1000, releaseLagDays: 17 }),
  fred("GACDFSA066MSFRBPHI", "费城联储制造业：总体", "Index", "monthly", "growth", { seasonalAdjustment: "SA", validMin: -100, validMax: 100, releaseLagDays: 0 }),
  fred("NOCDFSA066MSFRBPHI", "费城联储制造业：新订单", "Index", "monthly", "growth", { seasonalAdjustment: "SA", validMin: -100, validMax: 100, releaseLagDays: 0 }),
  // 流动性与金融条件
  fred("WALCL", "美联储总资产", "Millions of U.S. Dollars", "weekly", "liquidity", { validMin: 0, validMax: 20_000_000, releaseLagDays: 2 }),
  fred("WTREGEN", "财政部一般账户", "Millions of U.S. Dollars", "weekly", "liquidity", { validMin: 0, validMax: 5_000_000, releaseLagDays: 2 }),
  fred("RRPONTSYD", "隔夜逆回购余额", "Billions of US Dollars", "daily", "liquidity", { validMin: 0, validMax: 5_000, releaseLagDays: 1 }),
  fred("NFCI", "芝加哥联储金融条件指数", "Index", "weekly", "liquidity", { validMin: -5, validMax: 10, releaseLagDays: 6 }),
  // 指数与波动率
  fred("SP500", "标普 500 指数", "Index", "daily", "market", { copyrightHolder: "S&P Dow Jones Indices", validMin: 0, validMax: 100_000, ...daily(1) }),
  fred("NASDAQCOM", "纳斯达克综合指数", "Index Feb 5, 1971=100", "daily", "market", { copyrightHolder: "Nasdaq", validMin: 0, validMax: 200_000, ...daily(1) }),
  fred("NASDAQ100", "纳斯达克 100 指数", "Index", "daily", "market", { copyrightHolder: "Nasdaq", validMin: 0, validMax: 200_000, ...daily(1) }),
  fred("VIXCLS", "VIX", "Index", "daily", "market", { copyrightHolder: "Cboe", validMin: 5, validMax: 150, releaseLagDays: 1 }),
  fred("VXVCLS", "VIX3M", "Index", "daily", "market", { copyrightHolder: "Cboe", validMin: 5, validMax: 150, releaseLagDays: 1 }),
];

// 财政部当日收益率曲线：比 FRED 早一个工作日，FRED 到达后交叉核对
export const TREASURY_TENORS = [
  { column: "3 Mo", key: "3MO", fred: "fred:DGS3MO" },
  { column: "2 Yr", key: "2Y", fred: "fred:DGS2" },
  { column: "5 Yr", key: "5Y", fred: "fred:DGS5" },
  { column: "10 Yr", key: "10Y", fred: "fred:DGS10" },
  { column: "20 Yr", key: "20Y", fred: "fred:DGS20" },
  { column: "30 Yr", key: "30Y", fred: "fred:DGS30" },
] as const;

export const TREASURY_SERIES: SeriesDef[] = TREASURY_TENORS.map((t) => ({
  id: `treasury:${t.key}`,
  source: "treasury",
  sourceKey: t.column,
  nameZh: `${t.column.replace(" Mo", " 个月").replace(" Yr", " 年")}期国债收益率（财政部）`,
  unit: "Percent",
  frequency: "daily",
  category: "rates",
  calendar: "weekdays",
  ...PERCENT_RANGE,
  ...daily(0),
}));

// BLS：CPI 与非农在发布时直接取，比 FRED 更早
export const BLS_SERIES: SeriesDef[] = [
  { id: "bls:CUSR0000SA0", source: "bls", sourceKey: "CUSR0000SA0", nameZh: "CPI（BLS）", unit: "Index 1982-1984=100", frequency: "monthly", category: "inflation", seasonalAdjustment: "SA", validMin: 0, validMax: 2000, releaseLagDays: 15 },
  { id: "bls:CUSR0000SA0L1E", source: "bls", sourceKey: "CUSR0000SA0L1E", nameZh: "核心 CPI（BLS）", unit: "Index 1982-1984=100", frequency: "monthly", category: "inflation", seasonalAdjustment: "SA", validMin: 0, validMax: 2000, releaseLagDays: 15 },
  { id: "bls:CES0000000001", source: "bls", sourceKey: "CES0000000001", nameZh: "非农就业人数（BLS）", unit: "Thousands of Persons", frequency: "monthly", category: "growth", seasonalAdjustment: "SA", validMin: 0, validMax: 300_000, releaseLagDays: 8 },
  { id: "bls:LNS14000000", source: "bls", sourceKey: "LNS14000000", nameZh: "失业率（BLS）", unit: "Percent", frequency: "monthly", category: "growth", seasonalAdjustment: "SA", validMin: 0, validMax: 30, releaseLagDays: 8 },
];

// BEA：NIPA 表 T20804，按序列代码取值（同表中“市场定价”口径名称相近，不能按名称匹配）
export const BEA_SERIES: SeriesDef[] = [
  { id: "bea:DPCCRG", source: "bea", sourceKey: "T20804:DPCCRG", nameZh: "核心 PCE 价格指数（BEA）", unit: "Index 2017=100", frequency: "monthly", category: "inflation", seasonalAdjustment: "SA", validMin: 0, validMax: 1000, releaseLagDays: 31 },
  { id: "bea:DPCERG", source: "bea", sourceKey: "T20804:DPCERG", nameZh: "PCE 价格指数（BEA）", unit: "Index 2017=100", frequency: "monthly", category: "inflation", seasonalAdjustment: "SA", validMin: 0, validMax: 1000, releaseLagDays: 31 },
];

// Tiingo 日线：保存原始收盘价、现金分红与拆股系数，复权价由派生计算得到。
// 直接存供应商的复权价会在每次分红后整段历史被重新调整，产生大量“修订”。
export const MARKET_ETFS = ["SPY", "QQQ", "IWM", "SOXX", "RSP", "HYG", "IEF"] as const;

export function tiingoSeries(ticker: string): SeriesDef[] {
  const base = { source: "tiingo", frequency: "daily" as const, category: "market", calendar: "nyse" as const, releaseLagDays: 1 };
  return [
    { ...base, id: `tiingo:${ticker}:close`, sourceKey: `${ticker}:close`, nameZh: `${ticker} 收盘价（未复权）`, unit: "USD", validMin: 0, validMax: 1_000_000 },
    { ...base, frequency: "irregular" as const, id: `tiingo:${ticker}:div`, sourceKey: `${ticker}:div`, nameZh: `${ticker} 现金分红`, unit: "USD per share", validMin: 0, validMax: 10_000 },
    { ...base, frequency: "irregular" as const, id: `tiingo:${ticker}:split`, sourceKey: `${ticker}:split`, nameZh: `${ticker} 拆股系数`, unit: "Ratio", validMin: 0.0001, validMax: 10_000 },
  ];
}

export const TIINGO_SERIES: SeriesDef[] = MARKET_ETFS.flatMap(tiingoSeries);

// 1B 人工录入序列：没有可用接口的数据，录入时来源链接必填
const manual = (id: string, nameZh: string, unit: string, frequency: SeriesDef["frequency"], category: string, releaseLagDays: number, extra: Partial<SeriesDef> = {}): SeriesDef => ({
  id: `manual:${id}`,
  source: "manual",
  sourceKey: id,
  nameZh,
  unit,
  frequency,
  category,
  releaseLagDays,
  ...extra,
});

export const MANUAL_SERIES: SeriesDef[] = [
  manual("capex-guide-MU", "美光当财年资本开支指引", "Billions of U.S. Dollars", "quarterly", "memory", 30, { validMin: 0, validMax: 200 }),
  manual("cloud-growth-AZURE", "Azure 收入同比增速", "Percent", "quarterly", "ai-demand", 40, { validMin: -50, validMax: 300 }),
  manual("cloud-growth-GCP", "谷歌云收入同比增速", "Percent", "quarterly", "ai-demand", 40, { validMin: -50, validMax: 300 }),
  manual("cloud-growth-AWS", "AWS 收入同比增速", "Percent", "quarterly", "ai-demand", 40, { validMin: -50, validMax: 300 }),
];

export const ALL_SERIES: SeriesDef[] = [...FRED_SERIES, ...TREASURY_SERIES, ...BLS_SERIES, ...BEA_SERIES, ...TIINGO_SERIES, ...MANUAL_SERIES];
