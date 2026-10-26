// 日期工具：美股交易日历与美东时间换算。日期一律用 YYYY-MM-DD 字符串，避免时区歧义。

export function parseDate(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const x = parseDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return formatDate(x);
}

function weekday(d: string): number {
  return parseDate(d).getUTCDay();
}

function nthWeekday(year: number, month: number, dow: number, n: number): string {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (dow - first.getUTCDay() + 7) % 7;
  return formatDate(new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7)));
}

function lastWeekday(year: number, month: number, dow: number): string {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const offset = (last.getUTCDay() - dow + 7) % 7;
  return formatDate(new Date(Date.UTC(year, month + 1, -offset)));
}

// 复活节（格里高利历，匿名算法）
function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return formatDate(new Date(Date.UTC(year, month - 1, day)));
}

// 固定日期假日落在周末时的观察日：周六提前到周五，周日顺延到周一
function observed(d: string): string {
  const w = weekday(d);
  if (w === 6) return addDays(d, -1);
  if (w === 0) return addDays(d, 1);
  return d;
}

const holidayCache = new Map<number, Set<string>>();

// 纽交所全天休市日（不含提前收盘）
export function nyseHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const days = [
    nthWeekday(year, 0, 1, 3), // 马丁·路德·金纪念日
    nthWeekday(year, 1, 1, 3), // 总统日
    addDays(easter(year), -2), // 耶稣受难日
    lastWeekday(year, 4, 1), // 阵亡将士纪念日
    observed(`${year}-07-04`),
    nthWeekday(year, 8, 1, 1), // 劳动节
    nthWeekday(year, 10, 4, 4), // 感恩节
    observed(`${year}-12-25`),
  ];
  if (year >= 2022) days.push(observed(`${year}-06-19`));
  // 元旦落在周六时，纽交所不在前一年 12 月 31 日休市
  const newYear = `${year}-01-01`;
  if (weekday(newYear) !== 6) days.push(observed(newYear));
  const set = new Set(days);
  holidayCache.set(year, set);
  return set;
}

export function isTradingDay(d: string, calendar: "nyse" | "weekdays" = "nyse"): boolean {
  const w = weekday(d);
  if (w === 0 || w === 6) return false;
  return calendar === "weekdays" || !nyseHolidays(Number(d.slice(0, 4))).has(d);
}

export function nextTradingDay(d: string, calendar: "nyse" | "weekdays" = "nyse"): string {
  let x = addDays(d, 1);
  while (!isTradingDay(x, calendar)) x = addDays(x, 1);
  return x;
}

// 区间内（不含两端）应有但缺失的交易日
export function missingTradingDays(dates: string[], calendar: "nyse" | "weekdays"): string[] {
  const sorted = [...dates].sort();
  const have = new Set(sorted);
  const missing: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    for (let d = nextTradingDay(sorted[i - 1]!, calendar); d < sorted[i]!; d = nextTradingDay(d, calendar)) {
      if (!have.has(d)) missing.push(d);
    }
  }
  return missing;
}

// 美东时区相对 UTC 的偏移（毫秒，夏令时为 -4 小时，冬令时为 -5 小时）
function easternOffset(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - instant.getTime();
}

// 美东墙上时间 → UTC 时刻，自动处理夏令时切换
export function easternToUtc(date: string, time: string): Date {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const wall = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h, m);
  const first = wall - easternOffset(new Date(wall));
  return new Date(wall - easternOffset(new Date(first)));
}

export function easternDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(instant);
}

export function easternMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(instant);
  return Number(parts.find((p) => p.type === "hour")?.value) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
}

// 美股常规交易时段：交易日 9:30–16:00（美东）
export function isMarketOpen(instant: Date): boolean {
  const minutes = easternMinutes(instant);
  return isTradingDay(easternDate(instant)) && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}
