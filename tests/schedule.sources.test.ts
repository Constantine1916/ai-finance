import { describe, expect, it } from "vitest";
import { fredReleaseEvents, FRED_RELEASES, parseBeaIcs, parseFomc } from "@/sources/schedule";

// 结构取自 2026-10-27 的美联储与 BEA 页面（精简），用于验证解析逻辑
const meeting = (month: string, date: string) =>
  `<div class="row fomc-meeting"><div class="fomc-meeting__month col-xs-5 col-sm-3 col-md-2"><strong>${month}</strong></div><div class="fomc-meeting__date col-xs-4 col-sm-9 col-md-10 col-lg-1">${date}</div></div>`;
const fomcHtml = `
<h4><a id="1">2026 FOMC Meetings</a></h4>${meeting("October", "27-28")}${meeting("December", "8-9*")}
<h4><a id="2">2027 FOMC Meetings</a></h4>${meeting("January", "26-27")}
<h4><a id="3">2021 FOMC Meetings</a></h4>${meeting("Oct/Nov", "31-1")}${meeting("April", "22 (notation vote)")}`;

const bjTime = (d: Date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

describe("FOMC calendar", () => {
  const events = parseFomc(fomcHtml);

  it("uses the second meeting day at 14:00 Eastern and marks projection meetings", () => {
    const oct = events.find((e) => e.key === "fomc:2026-10-28")!;
    expect(oct.scheduledAt.toISOString()).toBe("2026-10-28T18:00:00.000Z"); // 夏令时
    const dec = events.find((e) => e.key === "fomc:2026-12-09")!;
    expect(dec.scheduledAt.toISOString()).toBe("2026-12-09T19:00:00.000Z"); // 冬令时
    expect(dec.title).toContain("经济预测");
    expect(oct.title).not.toContain("经济预测");
  });

  it("puts the decision of a cross-month meeting in the second month and skips notation votes", () => {
    expect(events.map((e) => e.key)).toEqual(["fomc:2026-10-28", "fomc:2026-12-09", "fomc:2027-01-27", "fomc:2021-11-01"]);
  });
});

describe("BEA calendar", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE-TIME:20261029T123000Z",
    "SUMMARY:Personal Income and Outlays\\, September 2",
    " 026",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "DTSTART;VALUE=DATE-TIME:20261029T123000Z",
    "SUMMARY:GDP (Advance Estimate)\\, 3rd Quarter 2026",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  it("keeps only PCE releases with their exact time and unfolds long lines", () => {
    const events = parseBeaIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ key: "pce:2026-10-29", title: "PCE 物价（September 2026）" });
    expect(events[0]!.scheduledAt.toISOString()).toBe("2026-10-29T12:30:00.000Z");
  });
});

describe("release times across the daylight saving switch", () => {
  const cpi = FRED_RELEASES.find((r) => r.kind === "cpi")!;
  it("keeps 08:30 Eastern, which is 20:30 Beijing in summer time and 21:30 in winter time", () => {
    const [before, after] = fredReleaseEvents(cpi, ["2026-10-29", "2026-11-06"]);
    expect(before!.scheduledAt.toISOString()).toBe("2026-10-29T12:30:00.000Z");
    expect(after!.scheduledAt.toISOString()).toBe("2026-11-06T13:30:00.000Z");
    expect(bjTime(before!.scheduledAt)).toContain("20:30");
    expect(bjTime(after!.scheduledAt)).toContain("21:30");
  });
});
