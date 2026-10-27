import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { events, observations } from "@/db/schema";
import { latestPrice, storeSnapshots } from "@/pipeline/intraday";
import { upsertSeries, writeObservations } from "@/pipeline/store";
import { releaseEventsToPoll } from "@/worker/release";
import { clearSymbol, testDb } from "./helpers";

const { db, close } = testDb();
afterAll(async () => {
  await clearSymbol(db, "SPY");
  await close();
});

beforeAll(async () => {
  await clearSymbol(db, "SPY");
  await upsertSeries(db, [
    { id: "tiingo:SPY", source: "tiingo", sourceKey: "SPY", nameZh: "SPY 复权收盘", unit: "USD", frequency: "daily", category: "market" },
    { id: "bls:CPI", source: "bls", sourceKey: "CUUR0000SA0L1E", nameZh: "核心 CPI", unit: "Index", frequency: "monthly", category: "inflation" },
  ]);
});

describe("intraday snapshots", () => {
  const open = new Date("2026-10-26T15:00:00Z"); // 11:00 EDT
  const closed = new Date("2026-10-26T21:00:00Z"); // 17:00 EDT

  it("shows the provisional snapshot during market hours and the official close otherwise", async () => {
    await writeObservations(db, { id: "tiingo:SPY", source: "tiingo", sourceKey: "SPY", nameZh: "SPY", unit: "USD", frequency: "daily", category: "market" }, [
      { obsDate: "2026-10-23", value: 759.97, unit: "USD", sourceRef: "https://api.tiingo.com", fetchedAt: new Date("2026-10-24T00:00:00Z") },
    ]);
    await storeSnapshots(db, [{ symbol: "SPY", price: 762.1, capturedAt: new Date("2026-10-26T14:55:00Z"), providerTs: null }]);

    expect(await latestPrice(db, "SPY", "tiingo:SPY", open)).toMatchObject({ kind: "provisional", price: 762.1, officialDate: "2026-10-23" });
    expect(await latestPrice(db, "SPY", "tiingo:SPY", closed)).toMatchObject({ kind: "official", price: 759.97 });
  });

  it("never writes snapshots into the daily history", async () => {
    const rows = await db.select().from(observations).where(eq(observations.seriesId, "tiingo:SPY"));
    expect(rows.map((r) => r.value)).toEqual([759.97]);
  });
});

describe("release-day polling", () => {
  const rule = { eventKinds: ["cpi"], intervalMinutes: 2, maxWaitMinutes: 60 };

  it("polls until the new observation arrives, then marks the event released", async () => {
    const scheduledAt = new Date("2026-11-12T13:30:00Z");
    const [event] = await db.insert(events).values({ key: `cpi:${scheduledAt.toISOString()}`, kind: "cpi", title: "CPI", scheduledAt, sourceUrl: "https://www.bls.gov/schedule/", seriesIds: ["bls:CPI"] }).returning();
    expect((await releaseEventsToPoll(db, rule, new Date("2026-11-12T13:29:00Z"), undefined)).length).toBe(0);
    expect((await releaseEventsToPoll(db, rule, new Date("2026-11-12T13:30:00Z"), undefined)).length).toBe(1);

    await writeObservations(db, { id: "bls:CPI", source: "bls", sourceKey: "x", nameZh: "x", unit: "Index", frequency: "monthly", category: "x" }, [
      { obsDate: "2026-10-01", value: 340.1, unit: "Index", sourceRef: "https://api.bls.gov", fetchedAt: new Date("2026-11-12T13:31:00Z") },
    ]);
    expect((await releaseEventsToPoll(db, rule, new Date("2026-11-12T13:32:00Z"), new Date("2026-11-12T13:30:00Z"))).length).toBe(0);
    const [after] = await db.select().from(events).where(eq(events.id, event!.id));
    expect(after!.status).toBe("released");
  });

  it("marks the event delayed after the wait limit", async () => {
    const scheduledAt = new Date("2026-12-10T13:30:00Z");
    const [event] = await db.insert(events).values({ key: `cpi:${scheduledAt.toISOString()}`, kind: "cpi", title: "CPI", scheduledAt, sourceUrl: "https://www.bls.gov/schedule/", seriesIds: ["bls:CPI"] }).returning();
    await releaseEventsToPoll(db, rule, new Date("2026-12-10T14:31:00Z"), new Date("2026-12-10T14:29:00Z"));
    const [after] = await db.select().from(events).where(eq(events.id, event!.id));
    expect(after!.status).toBe("delayed");
  });
});
