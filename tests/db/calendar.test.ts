import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { events } from "@/db/schema";
import { deleteManualEvent, saveEarnings, upsertOfficialEvents } from "@/calendar/importer";
import { eventsWithStatus } from "@/calendar/status";
import { upsertSeries, writeObservations } from "@/pipeline/store";
import type { OfficialEvent } from "@/sources/schedule";
import { testDb } from "./helpers";

const { db, close } = testDb();
afterAll(close);

const now = new Date("2026-10-27T12:00:00Z");
const ev = (key: string, at: string, seriesIds: string[] = []): OfficialEvent => ({ key, kind: key.split(":")[0]!, title: key, scheduledAt: new Date(at), sourceUrl: "https://example.org", seriesIds });

beforeAll(() => upsertSeries(db, [{ id: "cal:CPI", source: "bls", sourceKey: "x", nameZh: "x", unit: "Index", frequency: "monthly", category: "x" }]));

describe("official schedule import", () => {
  it("is idempotent", async () => {
    const batch = [ev("tst:2026-10-14", "2026-10-14T12:30:00Z"), ev("tst:2026-11-10", "2026-11-10T13:30:00Z"), ev("tst:2026-12-10", "2026-12-10T13:30:00Z")];
    await upsertOfficialEvents(db, ["tst"], batch, now);
    await upsertOfficialEvents(db, ["tst"], batch, now);
    expect((await db.select().from(events).where(eq(events.kind, "tst"))).length).toBe(3);
  });

  it("drops a rescheduled future date but keeps past events and manual entries", async () => {
    await saveEarnings(db, { symbol: "NVDA", date: "2026-11-19", timing: "amc", sourceUrl: "https://investor.nvidia.com", confirmed: true });
    const r = await upsertOfficialEvents(db, ["tst", "earnings"], [ev("tst:2026-10-14", "2026-10-14T12:30:00Z"), ev("tst:2026-11-12", "2026-11-12T13:30:00Z"), ev("tst:2026-12-10", "2026-12-10T13:30:00Z")], now);
    expect(r.removed).toEqual(["tst:2026-11-10"]);
    const keys = (await db.select({ key: events.key }).from(events)).map((e) => e.key);
    expect(keys).toEqual(expect.arrayContaining(["tst:2026-10-14", "tst:2026-11-12", "earnings:NVDA:2026-11-19"]));
  });
});

describe("manual earnings dates", () => {
  it("requires a source link and a valid symbol and time", async () => {
    await expect(saveEarnings(db, { symbol: "NVDA", date: "2026-11-19", timing: "amc", sourceUrl: "", confirmed: true })).rejects.toThrow(/来源链接/);
    await expect(saveEarnings(db, { symbol: "nv da", date: "2026-11-19", timing: "amc", sourceUrl: "https://x.org", confirmed: true })).rejects.toThrow(/代码/);
    await expect(saveEarnings(db, { symbol: "MU", date: "2026-12-17", timing: "time", sourceUrl: "https://x.org", confirmed: true })).rejects.toThrow(/美东时间/);
  });

  it("stores after-close as 16:05 Eastern and marks unconfirmed dates", async () => {
    await saveEarnings(db, { symbol: "mu", date: "2026-12-17", timing: "amc", sourceUrl: "https://investors.micron.com", confirmed: false });
    const [row] = await db.select().from(events).where(eq(events.key, "earnings:MU:2026-12-17"));
    expect(row!.scheduledAt.toISOString()).toBe("2026-12-17T21:05:00.000Z");
    expect(row).toMatchObject({ confirmed: false, origin: "manual", title: "MU 财报（盘后）" });
  });

  it("cannot delete official events through the manual path", async () => {
    expect(await deleteManualEvent(db, "tst:2026-12-10")).toBe(false);
    expect(await deleteManualEvent(db, "earnings:MU:2026-12-17")).toBe(true);
  });
});

describe("event status", () => {
  it("derives released, awaiting, held and upcoming", async () => {
    await upsertOfficialEvents(db, ["cpi2"], [ev("cpi2:2026-10-14", "2026-10-14T12:30:00Z", ["cal:CPI"]), ev("cpi2:2026-10-20", "2026-10-20T12:30:00Z", ["cal:CPI"])], now);
    await upsertOfficialEvents(db, ["fomc2"], [ev("fomc2:2026-09-16", "2026-09-16T18:00:00Z")], now);
    await writeObservations(db, { id: "cal:CPI", source: "bls", sourceKey: "x", nameZh: "x", unit: "Index", frequency: "monthly", category: "x" }, [
      { obsDate: "2026-09-01", value: 1, unit: "Index", sourceRef: "https://x.org", fetchedAt: new Date("2026-10-14T12:35:00Z") },
    ]);
    const rows = await eventsWithStatus(db, new Date("2026-09-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z"), now);
    const status = (key: string) => rows.find((r) => r.key === key)?.displayStatus;
    expect(status("cpi2:2026-10-14")).toBe("released");
    expect(status("cpi2:2026-10-20")).toBe("awaiting"); // 发布时刻之后没有新观测
    expect(status("fomc2:2026-09-16")).toBe("held");
    expect(status("tst:2026-12-10")).toBe("upcoming");
  });
});
