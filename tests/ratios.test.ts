import { describe, expect, it } from "vitest";
import { grossMargin, inventoryDays, opMargin, periodYoY } from "@/ai/ratios";

const o = (obsDate: string, value: number) => ({ obsDate, value });

describe("filing ratios", () => {
  it("uses reported gross profit, else revenue minus cost of revenue", () => {
    const r = grossMargin([o("2026-03-31", 100), o("2026-06-30", 200)], [o("2026-03-31", 60)], [o("2026-06-30", 150)]);
    expect(r.map((p) => p.value)).toEqual([60, 25]);
  });

  it("leaves operating margin empty when the company does not report it", () => {
    expect(opMargin([o("2026-03-31", 100)], []).map((p) => p.value)).toEqual([null]);
  });

  it("computes inventory days per quarter or year", () => {
    expect(inventoryDays([o("2026-06-30", 91)], [o("2026-06-30", 91)], false)[0]!.value).toBeCloseTo(91);
    expect(inventoryDays([o("2026-12-31", 100)], [o("2026-12-31", 365)], true)[0]!.value).toBeCloseTo(100);
  });

  it("compares with the period roughly a year earlier even when fiscal dates drift", () => {
    const r = periodYoY([o("2025-07-27", 50), o("2026-07-26", 75), o("2026-10-25", 80)]);
    expect(r.map((p) => p.value)).toEqual([null, 50, null]);
  });
});
