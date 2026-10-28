// 台积电月营收：取自其每月向 SEC 报送的 6-K（官网与台湾证交所接口拒绝程序访问）。
// 每份报告同时给出当月、上月、去年同月与年初累计（单位：百万新台币），用于交叉核对。

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface TsmcRevenueReport {
  month: string; // YYYY-MM-01
  current: number;
  priorMonth: number;
  yearAgo: number;
  ytd: number;
  ytdPriorYear: number;
}

const num = (s: string) => Number(s.replace(/,/g, ""));
const shiftMonth = (month: string, delta: number) => {
  const d = new Date(`${month}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
};
export { shiftMonth };

export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ");
}

export function parseRevenueReport(html: string): TsmcRevenueReport | null {
  const text = htmlToText(html);
  const head = /revenue for ([A-Z][a-z]+) (\d{4})/.exec(text);
  if (!head) return null;
  const monthIndex = MONTHS.indexOf(head[1]!);
  if (monthIndex < 0) return null;
  // 表格行：当月 上月 环比% 去年同月 同比% [年初累计 去年同期累计 同比%]；负数百分比用括号表示。
  // 1 月报告没有累计两列，累计即当月
  const row = /Net Revenue ([\d,]+) ([\d,]+) \(?-?[\d.]+\)? ([\d,]+) \(?-?[\d.]+\)?(?: ([\d,]+) ([\d,]+))?/.exec(text);
  if (!row) return null;
  const january = monthIndex === 0;
  if (!january && (row[4] === undefined || row[5] === undefined)) return null;
  return {
    month: `${head[2]}-${String(monthIndex + 1).padStart(2, "0")}-01`,
    current: num(row[1]!),
    priorMonth: num(row[2]!),
    yearAgo: num(row[3]!),
    ytd: january ? num(row[1]!) : num(row[4]!),
    ytdPriorYear: january ? num(row[3]!) : num(row[5]!),
  };
}
