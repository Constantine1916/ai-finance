import { easternToUtc } from "@/pipeline/calendar";
import { request, requestJson } from "./http";

// 官方发布日程的解析。只解析数据，不写库；写库见 src/calendar/importer.ts

const MONTHS: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

export interface OfficialEvent {
  key: string;
  kind: string;
  title: string;
  scheduledAt: Date;
  sourceUrl: string;
  seriesIds: string[];
  note?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export const FOMC_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";

// 美联储 FOMC 日历：会议第二天美东 14:00 公布决议。“Oct/Nov” + “31-1”表示结束日在第二个月；书面表决等非会议条目跳过
export function parseFomc(html: string): OfficialEvent[] {
  const out: OfficialEvent[] = [];
  const headers = [...html.matchAll(/(\d{4}) FOMC Meetings/g)];
  headers.forEach((h, i) => {
    const year = Number(h[1]);
    const section = html.slice(h.index, headers[i + 1]?.index ?? html.length);
    for (const m of section.matchAll(/fomc-meeting__month[^>]*><strong>([^<]+)<\/strong>[\s\S]*?fomc-meeting__date[^>]*>([^<]+)</g)) {
      const months = m[1]!.trim().split("/");
      const dates = m[2]!.trim();
      const match = /^(\d{1,2})(?:-(\d{1,2}))?(\*)?$/.exec(dates);
      if (!match) continue;
      const startDay = Number(match[1]);
      const endDay = Number(match[2] ?? match[1]);
      const endMonth = MONTHS[months[months.length > 1 && endDay < startDay ? 1 : 0]!.trim()];
      if (!endMonth) continue;
      // 跨年会议（例如 Dec/Jan）在本数据中未出现；若出现，结束日落在下一年
      const endYear = months.length > 1 && endMonth < (MONTHS[months[0]!.trim()] ?? endMonth) ? year + 1 : year;
      const date = `${endYear}-${pad(endMonth)}-${pad(endDay)}`;
      out.push({
        key: `fomc:${date}`,
        kind: "fomc",
        title: match[3] ? "FOMC 利率决议（含经济预测）" : "FOMC 利率决议",
        scheduledAt: easternToUtc(date, "14:00"),
        sourceUrl: FOMC_URL,
        seriesIds: [],
      });
    }
  });
  return out;
}

export const BEA_ICS_URL = "https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics";

// BEA 发布日历（ICS）：取“Personal Income and Outlays”，即 PCE 发布，时间以日历为准
export function parseBeaIcs(ics: string): OfficialEvent[] {
  const text = ics.replace(/\r?\n[ \t]/g, "");
  const out: OfficialEvent[] = [];
  for (const block of text.split("BEGIN:VEVENT").slice(1)) {
    const summary = /SUMMARY:(.*)/.exec(block)?.[1]?.replace(/\\,/g, ",").trim() ?? "";
    const start = /DTSTART[^:]*:(\d{8}T\d{6}Z)/.exec(block)?.[1];
    if (!start || !/^Personal Income and Outlays/.test(summary)) continue;
    const at = new Date(`${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T${start.slice(9, 11)}:${start.slice(11, 13)}:${start.slice(13, 15)}Z`);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(at);
    out.push({ key: `pce:${date}`, kind: "pce", title: `PCE 物价（${summary.replace("Personal Income and Outlays, ", "")}）`, scheduledAt: at, sourceUrl: "https://www.bea.gov/news/schedule", seriesIds: ["bea:DPCCRG", "bea:DPCERG"] });
  }
  return out;
}

// FRED 收录的官方发布日期（BLS 网站拒绝程序访问）。只有日期，时间按各机构惯例
export const FRED_RELEASES = [
  { id: 10, kind: "cpi", title: "CPI", time: "08:30", seriesIds: ["bls:CUSR0000SA0", "bls:CUSR0000SA0L1E"], sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm" },
  { id: 50, kind: "nfp", title: "非农就业报告", time: "08:30", seriesIds: ["bls:CES0000000001", "bls:LNS14000000"], sourceUrl: "https://www.bls.gov/schedule/news_release/empsit.htm" },
  { id: 180, kind: "claims", title: "初请失业金", time: "08:30", seriesIds: ["fred:ICSA"], sourceUrl: "https://www.dol.gov/ui/data.pdf" },
] as const;

export async function fetchFredReleaseDates(releaseId: number, apiKey: string, from: string, to: string, signal: AbortSignal) {
  const params = new URLSearchParams({ release_id: String(releaseId), api_key: apiKey, file_type: "json", include_release_dates_with_no_data: "true", realtime_start: from, realtime_end: to, sort_order: "asc", limit: "1000" });
  const body = await requestJson<{ release_dates: { date: string }[] }>("FRED", `https://api.stlouisfed.org/fred/release/dates?${params}`, { signal });
  return body.release_dates.map((d) => d.date);
}

export function fredReleaseEvents(release: (typeof FRED_RELEASES)[number], dates: string[]): OfficialEvent[] {
  return dates.map((date) => ({
    key: `${release.kind}:${date}`,
    kind: release.kind,
    title: release.title,
    scheduledAt: easternToUtc(date, release.time),
    sourceUrl: release.sourceUrl,
    seriesIds: [...release.seriesIds],
    note: `日期来自 FRED 收录的官方日程，时间按惯例美东 ${release.time}`,
  }));
}

export async function fetchText(source: string, url: string, signal: AbortSignal) {
  const response = await request(source, url, { signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; ai-finance personal dashboard)" } });
  return response.text();
}
