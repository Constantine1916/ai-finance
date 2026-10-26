import { describe, expect, it } from "vitest";
import { easternToUtc } from "@/pipeline/calendar";
import { checkIntradayBudget, isDue, releasePoll } from "@/pipeline/schedule";

const at = (iso: string) => new Date(iso);

describe("isDue", () => {
  const daily = { kind: "daily", easternTime: "18:30", tradingDaysOnly: true } as const;

  it("runs once per trading day after the Eastern time", () => {
    expect(isDue(daily, at("2026-10-26T22:29:00Z"), undefined)).toBe(false); // 18:29 EDT
    expect(isDue(daily, at("2026-10-26T22:31:00Z"), undefined)).toBe(true);
    expect(isDue(daily, at("2026-10-26T23:00:00Z"), at("2026-10-26T22:31:00Z"))).toBe(false);
    expect(isDue(daily, at("2026-10-27T22:31:00Z"), at("2026-10-26T22:31:00Z"))).toBe(true);
  });

  it("follows the Eastern clock across the daylight saving switch", () => {
    expect(isDue(daily, at("2026-11-02T23:29:00Z"), undefined)).toBe(false); // 18:29 EST
    expect(isDue(daily, at("2026-11-02T23:31:00Z"), undefined)).toBe(true);
  });

  it("skips non-trading days when asked", () => {
    expect(isDue(daily, at("2026-11-26T23:31:00Z"), undefined)).toBe(false);
  });

  it("runs market-hours jobs only while the market is open", () => {
    const t = { kind: "market-hours", minutes: 5 } as const;
    expect(isDue(t, at("2026-10-26T14:00:00Z"), at("2026-10-26T13:55:00Z"))).toBe(true);
    expect(isDue(t, at("2026-10-26T14:00:00Z"), at("2026-10-26T13:57:00Z"))).toBe(false);
    expect(isDue(t, at("2026-10-26T21:00:00Z"), undefined)).toBe(false);
  });
});

describe("releasePoll", () => {
  const release = { scheduledAt: easternToUtc("2026-11-12", "08:30"), intervalMinutes: 2, maxWaitMinutes: 60 };
  const min = (m: number) => new Date(release.scheduledAt.getTime() + m * 60_000);

  it("schedules CPI at 08:30 EST after the switch back", () => {
    expect(release.scheduledAt.toISOString()).toBe("2026-11-12T13:30:00.000Z");
  });

  it("waits before the release, polls at release time, then every interval", () => {
    expect(releasePoll(release, min(-1), undefined, false)).toBe("wait");
    expect(releasePoll(release, min(0), undefined, false)).toBe("poll");
    expect(releasePoll(release, min(1), min(0), false)).toBe("wait");
    expect(releasePoll(release, min(2), min(0), false)).toBe("poll");
  });

  it("stops when data arrives or the wait limit passes", () => {
    expect(releasePoll(release, min(4), min(2), true)).toBe("done");
    expect(releasePoll(release, min(61), min(58), false)).toBe("give_up");
  });

  it("polls on release day even if the job ran earlier that day", () => {
    expect(releasePoll(release, min(0), min(-120), false)).toBe("poll");
  });
});

describe("intraday budget", () => {
  it("accepts 50 symbols every 5 minutes on a 60/min plan", () => {
    expect(checkIntradayBudget(50, 5, 60)).toMatchObject({ ok: true, perMinute: 10 });
  });

  it("rejects configurations above 80% of the limit", () => {
    const r = checkIntradayBudget(250, 5, 60);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("超过");
  });
});
