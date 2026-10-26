import { describe, expect, it } from "vitest";
import { easternToUtc, isMarketOpen, isTradingDay, missingTradingDays, nextTradingDay, nyseHolidays } from "@/pipeline/calendar";

describe("NYSE calendar", () => {
  it("lists the 2026 full-day holidays", () => {
    expect([...nyseHolidays(2026)].sort()).toEqual([
      "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
      "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
    ]);
  });

  it("does not close on Dec 31 when New Year's Day falls on Saturday", () => {
    expect(isTradingDay("2021-12-31")).toBe(true);
    expect(nyseHolidays(2022).has("2021-12-31")).toBe(false);
  });

  it("skips weekends and holidays", () => {
    expect(nextTradingDay("2026-04-02")).toBe("2026-04-06"); // 耶稣受难日 + 周末
    expect(nextTradingDay("2026-04-02", "weekdays")).toBe("2026-04-03");
  });

  it("reports missing trading days without counting holidays", () => {
    expect(missingTradingDays(["2026-07-01", "2026-07-07"], "nyse")).toEqual(["2026-07-02", "2026-07-06"]);
  });
});

describe("Eastern time conversion", () => {
  it("handles the March daylight saving switch", () => {
    expect(easternToUtc("2026-03-06", "08:30").toISOString()).toBe("2026-03-06T13:30:00.000Z");
    expect(easternToUtc("2026-03-09", "08:30").toISOString()).toBe("2026-03-09T12:30:00.000Z");
  });

  it("handles the November switch back", () => {
    expect(easternToUtc("2026-10-30", "08:30").toISOString()).toBe("2026-10-30T12:30:00.000Z");
    expect(easternToUtc("2026-11-02", "08:30").toISOString()).toBe("2026-11-02T13:30:00.000Z");
  });

  it("knows regular trading hours", () => {
    expect(isMarketOpen(new Date("2026-10-26T13:29:00Z"))).toBe(false); // 09:29 EDT
    expect(isMarketOpen(new Date("2026-10-26T13:30:00Z"))).toBe(true);
    expect(isMarketOpen(new Date("2026-11-26T15:00:00Z"))).toBe(false); // 感恩节
    expect(isMarketOpen(new Date("2026-11-02T14:00:00Z"))).toBe(false); // 09:00 EST
  });
});
