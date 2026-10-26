import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ManualEntryError, manualHistory, saveManualEntry } from "@/pipeline/manual";
import { readSeries, upsertSeries } from "@/pipeline/store";
import { testDb } from "./helpers";

const { db, close } = testDb();
afterAll(close);

beforeAll(() =>
  upsertSeries(db, [
    { id: "manual:dram", source: "manual", sourceKey: "dram", nameZh: "DRAM 合约价", unit: "USD", frequency: "monthly", category: "memory" },
    { id: "fred:NOTMANUAL", source: "fred", sourceKey: "X", nameZh: "x", unit: "USD", frequency: "daily", category: "x" },
  ]),
);

const entry = { seriesId: "manual:dram", obsDate: "2026-10-01", value: "3.5", unit: "USD", sourceUrl: "https://example.org/report" };

describe("manual entries", () => {
  it("requires a source link", async () => {
    await expect(saveManualEntry(db, { ...entry, sourceUrl: "" })).rejects.toThrow(/来源链接/);
    await expect(saveManualEntry(db, { ...entry, sourceUrl: "example.org" })).rejects.toThrow(ManualEntryError);
  });

  it("requires the registered unit and a manual series", async () => {
    await expect(saveManualEntry(db, { ...entry, unit: "CNY" })).rejects.toThrow(/单位必须是 USD/);
    await expect(saveManualEntry(db, { ...entry, seriesId: "fred:NOTMANUAL" })).rejects.toThrow(/不接受人工录入/);
  });

  it("keeps every version and revises the observation", async () => {
    await saveManualEntry(db, entry);
    await saveManualEntry(db, { ...entry, value: "3.6", sourceUrl: "https://example.org/corrected" });
    const history = await manualHistory(db, "manual:dram", "2026-10-01");
    expect(history.map((h) => [h.version, h.value, h.isCurrent])).toEqual([[2, 3.6, true], [1, 3.5, false]]);
    expect(await readSeries(db, "manual:dram")).toEqual([{ obsDate: "2026-10-01", value: 3.6 }]);
  });
});
