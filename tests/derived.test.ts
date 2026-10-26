import { describe, expect, it } from "vitest";
import { alignAsOf, annualized3m, drawdown, percentileRank, ratio, sma, yoy, type Point } from "@/pipeline/derived";

const monthly = (values: (number | null)[], start = 2025): Point[] =>
  values.map((value, i) => ({ date: `${start + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`, value }));

describe("derived metrics", () => {
  it("computes year-over-year and leaves it missing without a base", () => {
    const s = monthly([...Array(12).fill(100), 103, ...Array(11).fill(100)]);
    const r = yoy(s);
    expect(r[11]!.value).toBeNull();
    expect(r[12]!.value).toBeCloseTo(3);
  });

  it("propagates a missing base month as missing, not zero", () => {
    const s = monthly([null, ...Array(12).fill(100)]);
    expect(yoy(s)[12]!.value).toBeNull();
  });

  it("annualizes three-month change", () => {
    const s = monthly([100, 100.5, 101, 101.0075]);
    expect(annualized3m(s)[3]!.value).toBeCloseTo(((101.0075 / 100) ** 4 - 1) * 100);
  });

  it("averages only complete windows", () => {
    const s: Point[] = [1, 2, 3, null, 5].map((value, i) => ({ date: `2026-01-0${i + 1}`, value }));
    expect(sma(s, 3).map((p) => p.value)).toEqual([null, null, 2, null, null]);
  });

  it("measures drawdown from the window high", () => {
    const s: Point[] = [100, 120, 90].map((value, i) => ({ date: `2026-01-0${i + 1}`, value }));
    expect(drawdown(s, 3)[2]!.value).toBeCloseTo(-25);
  });

  it("aligns ratios by date", () => {
    const a: Point[] = [{ date: "d1", value: 10 }, { date: "d2", value: 12 }];
    const b: Point[] = [{ date: "d2", value: 4 }, { date: "d3", value: 5 }];
    expect(ratio(a, b)).toEqual([{ date: "d2", value: 3 }]);
  });

  it("ranks within the window", () => {
    const s: Point[] = [1, 2, 3, 4].map((value, i) => ({ date: `2026-01-0${i + 1}`, value }));
    expect(percentileRank(s, 4)[3]!.value).toBe(100);
    expect(percentileRank(s, 4)[2]!.value).toBeNull();
  });

  it("aligns weekly data to daily dates within a maximum age", () => {
    const weekly: Point[] = [{ date: "2026-10-14", value: 7 }, { date: "2026-10-21", value: 8 }];
    expect(alignAsOf(["2026-10-13", "2026-10-20", "2026-10-22", "2026-11-05"], weekly, 7).map((p) => p.value)).toEqual([null, 7, 8, null]);
  });
});
