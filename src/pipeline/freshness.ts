import { addDays, nextTradingDay } from "./calendar";
import type { Frequency } from "./types";

// 下一期数据所属期间的期末日期。FRED 月度序列的日期是当月 1 日，季度是季初。
function nextPeriodEnd(lastObsDate: string, frequency: Exclude<Frequency, "irregular">): string {
  const [y, m] = [Number(lastObsDate.slice(0, 4)), Number(lastObsDate.slice(5, 7))];
  const monthEnd = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  switch (frequency) {
    case "daily":
      return nextTradingDay(lastObsDate, "weekdays");
    case "weekly":
      return addDays(lastObsDate, 7);
    case "monthly":
      return monthEnd(y, m + 1);
    case "quarterly":
      return monthEnd(y, m + 5);
    case "annual":
      return monthEnd(y + 1, 12);
  }
}

const GRACE_DAYS: Record<Exclude<Frequency, "irregular">, number> = { daily: 2, weekly: 2, monthly: 3, quarterly: 7, annual: 14 };

export interface Freshness {
  expectedBy: string; // 下一期最晚应到达的日期
  stale: boolean;
}

export function freshness(lastObsDate: string, frequency: Frequency, releaseLagDays: number, today: string): Freshness | null {
  if (frequency === "irregular") return null;
  const expected = addDays(nextPeriodEnd(lastObsDate, frequency), releaseLagDays);
  const expectedBy = addDays(expected, GRACE_DAYS[frequency]);
  return { expectedBy, stale: today > expectedBy };
}

// 页面上“距今多久”的中文描述
export function ageText(from: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}
