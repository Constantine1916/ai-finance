import { describe, expect, it } from "vitest";
import { convertUsd, UnitError } from "@/pipeline/units";
import type { SeriesDef } from "@/pipeline/types";
import { validateObservation } from "@/pipeline/validate";

const def: SeriesDef = { id: "fred:DGS10", source: "fred", sourceKey: "DGS10", nameZh: "10 年期国债收益率", unit: "Percent", frequency: "daily", category: "rates", validMin: 0, validMax: 20, jumpSigma: 6 };
const obs = (obsDate: string, value: number, unit = "Percent") => ({ obsDate, value, unit, sourceRef: "https://fred.stlouisfed.org/series/DGS10", fetchedAt: new Date() });
const history = Array.from({ length: 30 }, (_, i) => ({ obsDate: `2026-09-${String(i + 1).padStart(2, "0")}`, value: 4 + (i % 2) * 0.02 }));

describe("validateObservation", () => {
  it("accepts a normal value", () => {
    expect(validateObservation(def, obs("2026-10-01", 4.03), history).ok).toBe(true);
  });

  it("flags out-of-range values", () => {
    expect(validateObservation(def, obs("2026-10-01", 25), []).issues.map((i) => i.code)).toEqual(["out_of_range"]);
  });

  it("flags unit mismatches", () => {
    expect(validateObservation(def, obs("2026-10-01", 4, "Basis Points"), []).issues.map((i) => i.code)).toContain("unit_mismatch");
  });

  it("flags abnormal jumps only with enough history", () => {
    expect(validateObservation(def, obs("2026-10-01", 5.5), history).issues.map((i) => i.code)).toEqual(["abnormal_jump"]);
    expect(validateObservation(def, obs("2026-10-01", 5.5), history.slice(0, 10)).ok).toBe(true);
  });
});

describe("convertUsd", () => {
  it("converts registered units and refuses unknown ones", () => {
    expect(convertUsd(952002, "Millions of U.S. Dollars", "Billions of U.S. Dollars")).toBeCloseTo(952.002);
    expect(convertUsd(0.2, "Billions of U.S. Dollars", "Millions of U.S. Dollars")).toBeCloseTo(200);
    expect(() => convertUsd(1, "Percent", "Millions of U.S. Dollars")).toThrow(UnitError);
  });
});
