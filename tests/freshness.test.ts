import { describe, expect, it } from "vitest";
import { ageText, freshness } from "@/pipeline/freshness";

describe("freshness", () => {
  it("expects monthly CPI after the next month ends plus the release lag", () => {
    expect(freshness("2026-09-01", "monthly", 13, "2026-11-16")).toEqual({ expectedBy: "2026-11-16", stale: false });
    expect(freshness("2026-09-01", "monthly", 13, "2026-11-17")?.stale).toBe(true);
  });

  it("expects weekly claims a week later plus lag", () => {
    expect(freshness("2026-10-17", "weekly", 5, "2026-10-31")).toEqual({ expectedBy: "2026-10-31", stale: false });
    expect(freshness("2026-10-17", "weekly", 5, "2026-11-01")?.stale).toBe(true);
  });

  it("skips weekends for daily series", () => {
    expect(freshness("2026-10-23", "daily", 1, "2026-10-29")?.stale).toBe(false);
    expect(freshness("2026-10-23", "daily", 1, "2026-10-30")?.stale).toBe(true);
  });

  it("never marks irregular event series stale", () => {
    expect(freshness("2020-01-01", "irregular", 0, "2026-10-27")).toBeNull();
  });

  it("describes age in Chinese", () => {
    const now = new Date("2026-10-26T12:00:00Z");
    expect(ageText(new Date("2026-10-26T11:55:00Z"), now)).toBe("5 分钟前");
    expect(ageText(new Date("2026-10-26T09:00:00Z"), now)).toBe("3 小时前");
    expect(ageText(new Date("2026-10-23T12:00:00Z"), now)).toBe("3 天前");
  });
});
