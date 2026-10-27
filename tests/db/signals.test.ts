import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pendingObservations, signalStates } from "@/db/schema";
import { saveDerived } from "@/jobs/derive";
import { storeSnapshots } from "@/pipeline/intraday";
import { upsertSeries, writeObservations } from "@/pipeline/store";
import { FRED_SERIES, tiingoSeries } from "@/sources/catalog";
import { evaluateRule, logStateChanges, paramHistory, saveParams } from "@/signals/engine";
import { RULE_MAP } from "@/signals/rules";
import { clearSymbol, testDb } from "./helpers";

const { db, close } = testDb();
afterAll(async () => {
  await clearSymbol(db, "SPY");
  await close();
});

const fred = (key: string) => FRED_SERIES.find((s) => s.id === `fred:${key}`)!;
const now = new Date("2026-10-27T21:00:00Z"); // 美东 17:00，已收盘
const fetchedAt = new Date("2026-10-27T00:00:00Z");
const daysBack = (n: number, end = "2026-10-26") =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(end) - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10)).filter((d) => ![0, 6].includes(new Date(d).getUTCDay()));
const rows = (dates: string[], f: (i: number) => number, unit = "Percent") => dates.map((obsDate, i) => ({ obsDate, value: f(i), unit, sourceRef: "https://example.org", fetchedAt }));

beforeAll(async () => {
  await clearSymbol(db, "SPY");
  await upsertSeries(db, [fred("SAHMREALTIME"), fred("NFCI"), fred("BAMLH0A0HYM2"), ...tiingoSeries("SPY")]);
  await writeObservations(db, fred("SAHMREALTIME"), rows(["2026-07-01", "2026-08-01", "2026-09-01"], (i) => [0.2, 0.4, 0.6][i]!, "Percentage Points"));
  // NFCI 停在 2026-08，按周度与发布延迟已经过期
  await writeObservations(db, fred("NFCI"), rows(["2026-08-07", "2026-08-14"], () => -0.4, "Index"));
  await writeObservations(db, fred("BAMLH0A0HYM2"), rows(daysBack(120), () => 3));
});

describe("signal evaluation", () => {
  it("evaluates a fresh rule", async () => {
    const e = await evaluateRule(db, RULE_MAP.get("sahm")!, now);
    expect(e).toMatchObject({ state: "warning", reason: null });
    expect(e.current?.value).toBe(0.6);
  });

  it("shows insufficient data when an input is stale, never normal", async () => {
    const e = await evaluateRule(db, RULE_MAP.get("nfci")!, now);
    expect(e.state).toBe("insufficient");
    expect(e.reason).toContain("已过期");
    expect(e.current?.state).toBe("normal"); // 计算值仍是正常，但不作为当前状态显示
  });

  it("shows insufficient data when inputs are missing", async () => {
    const e = await evaluateRule(db, RULE_MAP.get("vix-term")!, now);
    expect(e.state).toBe("insufficient");
  });

  it("shows insufficient data when the newest observation is pending review", async () => {
    await db.insert(pendingObservations).values({ seriesId: "fred:BAMLH0A0HYM2", obsDate: "2026-10-27", value: 40, unit: "Percent", sourceRef: "https://example.org", fetchedAt, issues: [] });
    const e = await evaluateRule(db, RULE_MAP.get("hy-spread-widening")!, now);
    expect(e.state).toBe("insufficient");
    expect(e.reason).toContain("待确认");
    await db.delete(pendingObservations).where(eq(pendingObservations.seriesId, "fred:BAMLH0A0HYM2"));
    expect((await evaluateRule(db, RULE_MAP.get("hy-spread-widening")!, now)).state).toBe("normal");
  });
});

describe("threshold overrides", () => {
  it("validates, recomputes and keeps the history", async () => {
    await expect(saveParams(db, "sahm", { warning: "abc", watch: "0.3" })).rejects.toThrow(/必须是数值/);
    await saveParams(db, "sahm", { warning: "0.7", watch: "0.5" });
    const e = await evaluateRule(db, RULE_MAP.get("sahm")!, now);
    expect(e).toMatchObject({ state: "watch", overridden: true });
    await saveParams(db, "sahm", { warning: "0.5", watch: "0.3" });
    expect((await evaluateRule(db, RULE_MAP.get("sahm")!, now)).overridden).toBe(false);
    expect((await paramHistory(db, "sahm")).length).toBe(2);
  });
});

describe("state log", () => {
  it("logs only changes", async () => {
    const e = await evaluateRule(db, RULE_MAP.get("sahm")!, now);
    expect(await logStateChanges(db, [e])).toHaveLength(1);
    expect(await logStateChanges(db, [e])).toHaveLength(0);
    const logged = await db.select().from(signalStates).where(eq(signalStates.ruleId, "sahm"));
    expect(logged.map((l) => [l.previousState, l.state, l.ruleVersion])).toEqual([[null, "warning", 1]]);
  });

  it("shows an intraday provisional state but logs only the confirmed one", async () => {
    const dates = daysBack(5);
    await writeObservations(db, tiingoSeries("SPY")[0]!, rows(dates, () => 700, "USD"));
    await saveDerived(db, "adj:SPY", dates.map((d) => ({ date: d, value: 700 })));
    await saveDerived(db, "sma200:SPY", dates.map((d) => ({ date: d, value: 650 })));
    const open = new Date("2026-10-27T15:00:00Z"); // 美东 11:00
    await storeSnapshots(db, [{ symbol: "SPY", price: 640, capturedAt: new Date("2026-10-27T14:55:00Z"), providerTs: null }]);

    const e = await evaluateRule(db, RULE_MAP.get("spy-200dma")!, open);
    expect(e.state).toBe("normal"); // 收盘确认状态
    expect(e.provisional?.state).toBe("warning"); // 盘中跌破均线
    await logStateChanges(db, [e]);
    const logged = await db.select().from(signalStates).where(eq(signalStates.ruleId, "spy-200dma"));
    expect(logged.map((l) => l.state)).toEqual(["normal"]);
  });
});
