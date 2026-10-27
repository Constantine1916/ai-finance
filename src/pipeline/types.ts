// 数据管道的公共类型

// irregular：只在事件发生时有值（分红、拆股），不做过期判断
export type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "irregular";
export type TradingCalendar = "nyse" | "weekdays" | "none";

export interface SeriesDef {
  id: string; // 例如 fred:DGS10
  source: string;
  sourceKey: string;
  nameZh: string;
  unit: string;
  frequency: Frequency;
  category: string;
  seasonalAdjustment?: string;
  copyrightHolder?: string;
  validMin?: number;
  validMax?: number;
  jumpSigma?: number; // 单期变化超过近期变化标准差的倍数时标为待确认
  releaseLagDays?: number; // 期末到发布的典型天数
  timelinessTargetMinutes?: number;
  calendar?: TradingCalendar; // 用于检查日度序列缺口
}

// 适配器返回的原始观测，必须带全部追溯信息
export interface ObservationInput {
  obsDate: string; // YYYY-MM-DD，来源本身的日期
  value: number;
  unit: string;
  sourceRef: string; // 原始链接或申报编号
  fetchedAt: Date;
}

export interface StoredPoint {
  obsDate: string;
  value: number;
}
