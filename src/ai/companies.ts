// AI 硬件关注池的默认名单与 SEC 科目映射。关注池成员可在页面上编辑（存于 universe_members），这里只是首次初始化的默认值。

export type Layer = "compute" | "foundry-equipment" | "memory" | "servers" | "networking" | "power" | "hyperscaler";
export type Cyclicality = "strong" | "medium" | "growth";

export const LAYERS: { id: Layer; name: string }[] = [
  { id: "compute", name: "算力芯片" },
  { id: "foundry-equipment", name: "代工与设备" },
  { id: "memory", name: "存储" },
  { id: "servers", name: "服务器" },
  { id: "networking", name: "网络与光模块" },
  { id: "power", name: "电力与散热" },
  { id: "hyperscaler", name: "云厂商（需求端）" },
];

export const CYCLICALITY_NAME: Record<Cyclicality, string> = { strong: "强周期", medium: "中等周期", growth: "偏成长" };

export interface DefaultMember {
  symbol: string;
  layer: Layer;
  cyclicality: Cyclicality;
  inHyperscalerCapex?: boolean;
}

export const DEFAULT_UNIVERSE: DefaultMember[] = [
  { symbol: "NVDA", layer: "compute", cyclicality: "growth" },
  { symbol: "AMD", layer: "compute", cyclicality: "growth" },
  { symbol: "AVGO", layer: "compute", cyclicality: "growth" },
  { symbol: "MRVL", layer: "compute", cyclicality: "growth" },
  { symbol: "TSM", layer: "foundry-equipment", cyclicality: "medium" },
  { symbol: "ASML", layer: "foundry-equipment", cyclicality: "strong" },
  { symbol: "AMAT", layer: "foundry-equipment", cyclicality: "strong" },
  { symbol: "LRCX", layer: "foundry-equipment", cyclicality: "strong" },
  { symbol: "KLAC", layer: "foundry-equipment", cyclicality: "strong" },
  { symbol: "MU", layer: "memory", cyclicality: "strong" },
  { symbol: "SMCI", layer: "servers", cyclicality: "strong" },
  { symbol: "DELL", layer: "servers", cyclicality: "strong" },
  { symbol: "ANET", layer: "networking", cyclicality: "medium" },
  { symbol: "COHR", layer: "networking", cyclicality: "medium" },
  { symbol: "VRT", layer: "power", cyclicality: "medium" },
  { symbol: "ETN", layer: "power", cyclicality: "medium" },
  { symbol: "MSFT", layer: "hyperscaler", cyclicality: "growth", inHyperscalerCapex: true },
  { symbol: "GOOGL", layer: "hyperscaler", cyclicality: "growth", inHyperscalerCapex: true },
  { symbol: "AMZN", layer: "hyperscaler", cyclicality: "growth", inHyperscalerCapex: true },
  { symbol: "META", layer: "hyperscaler", cyclicality: "growth", inHyperscalerCapex: true },
  { symbol: "ORCL", layer: "hyperscaler", cyclicality: "growth", inHyperscalerCapex: true },
];

export type Metric = "revenue" | "cogs" | "grossProfit" | "opIncome" | "netIncome" | "rnd" | "capex" | "dilutedShares" | "inventory" | "equity";

// additive=false 的指标（加权平均股数）不能用累计值相减推算单季，也不做四季合计核对
export const METRICS: Record<Metric, { name: string; kind: "duration" | "instant"; unit: "currency" | "shares"; additive?: false }> = {
  revenue: { name: "营收", kind: "duration", unit: "currency" },
  cogs: { name: "营业成本", kind: "duration", unit: "currency" },
  grossProfit: { name: "毛利", kind: "duration", unit: "currency" },
  opIncome: { name: "营业利润", kind: "duration", unit: "currency" },
  netIncome: { name: "净利润", kind: "duration", unit: "currency" },
  rnd: { name: "研发费用", kind: "duration", unit: "currency" },
  capex: { name: "资本开支", kind: "duration", unit: "currency" },
  dilutedShares: { name: "稀释加权股数", kind: "duration", unit: "shares", additive: false },
  inventory: { name: "存货", kind: "instant", unit: "currency" },
  equity: { name: "股东权益", kind: "instant", unit: "currency" },
};

// 每个指标的候选科目，逐期取第一个有值的科目（处理公司在不同年份更换科目名称）
export const DEFAULT_CONCEPTS: Record<Metric, string[]> = {
  revenue: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet", "Revenue"],
  cogs: ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold", "CostOfSales"],
  grossProfit: ["GrossProfit"],
  opIncome: ["OperatingIncomeLoss", "ProfitLossFromOperatingActivities"],
  netIncome: ["NetIncomeLoss", "ProfitLossAttributableToOwnersOfParent"],
  rnd: ["ResearchAndDevelopmentExpense", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets", "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"],
  dilutedShares: ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfShareOutstandingBasicAndDiluted"],
  inventory: ["InventoryNet", "Inventories"],
  equity: ["StockholdersEquity", "EquityAttributableToOwnersOfParent"],
};

// 个别公司的科目映射（2026-10-28 按其申报核对）：未登记的指标使用默认候选
export const CONCEPT_OVERRIDES: Record<string, Partial<Record<Metric, string[]>>> = {
  // 2024 财年后净利润与权益改用含少数股东权益的科目，两者在博通基本相同
  AVGO: { netIncome: ["NetIncomeLoss", "ProfitLoss"], equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"] },
};

export const CONCEPT_MAP_VERSION = "2026-10-28";

export function conceptsFor(symbol: string, metric: Metric): string[] {
  return CONCEPT_OVERRIDES[symbol]?.[metric] ?? DEFAULT_CONCEPTS[metric];
}
