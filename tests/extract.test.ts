import { describe, expect, it } from "vitest";
import { annualSeries, calendarQuarter, checkFourQuarters, consistentMismatches, instantSeries, quarterlySeries } from "@/ai/extract";
import type { Fact } from "@/sources/edgar";

// 样本按真实申报的结构构造（数值单位为十亿，便于阅读）
const fact = (start: string | undefined, end: string, val: number, form = "10-Q", filed = "2026-01-01", accn = "a"): Fact => ({ start, end, val, form, filed, accn });

describe("quarterlySeries", () => {
  it("prefers three-month values and derives cash-flow quarters from year-to-date totals", () => {
    const capex = [
      fact("2025-07-01", "2025-09-30", 19.4),
      fact("2025-07-01", "2025-12-31", 49.3),
      fact("2025-07-01", "2026-03-31", 80.2),
      fact("2025-07-01", "2026-06-30", 116.0, "10-K"),
    ];
    const q = quarterlySeries([["PaymentsToAcquirePropertyPlantAndEquipment", capex]]);
    expect(q.map((x) => [x.end, Number(x.value.toFixed(2)), x.derived])).toEqual([
      ["2025-09-30", 19.4, false],
      ["2025-12-31", 29.9, true],
      ["2026-03-31", 30.9, true],
      ["2026-06-30", 35.8, true],
    ]);
  });

  it("falls back to the next concept per period when a company switches tags", () => {
    const old = [fact("2020-02-01", "2020-04-26", 1.1)];
    const current = [fact("2026-04-27", "2026-07-26", 2.7)];
    const q = quarterlySeries([["PaymentsToAcquirePropertyPlantAndEquipment", old], ["PaymentsToAcquireProductiveAssets", current]]);
    expect(q.map((x) => [x.end, x.concept])).toEqual([
      ["2020-04-26", "PaymentsToAcquirePropertyPlantAndEquipment"],
      ["2026-07-26", "PaymentsToAcquireProductiveAssets"],
    ]);
  });

  it("rejects an annual value mislabeled as a three-month period (Oracle FY2020)", () => {
    const revenues = [fact("2020-03-01", "2020-05-31", 39.07, "10-K")];
    const rfcc = [
      fact("2019-06-01", "2019-08-31", 9.22),
      fact("2019-09-01", "2019-11-30", 9.61),
      fact("2019-12-01", "2020-02-29", 9.8),
      fact("2019-06-01", "2020-02-29", 28.63),
      fact("2019-06-01", "2020-05-31", 39.07, "10-K"),
    ];
    const q = quarterlySeries([["Revenues", revenues], ["RevenueFromContractWithCustomerExcludingAssessedTax", rfcc]]);
    const q4 = q.find((x) => x.end === "2020-05-31")!;
    expect(q4.value).toBeCloseTo(10.44);
    expect(q4.derived).toBe(true);
    expect(checkFourQuarters(q, annualSeries([["RevenueFromContractWithCustomerExcludingAssessedTax", rfcc]]))).toEqual([]);
  });

  it("uses the latest filing for a period and remembers the restated value", () => {
    const q = quarterlySeries([["Revenues", [fact("2026-01-01", "2026-03-31", 10, "10-Q", "2026-05-01", "old"), fact("2026-01-01", "2026-03-31", 10.5, "10-Q/A", "2026-08-01", "new")]]]);
    expect(q[0]).toMatchObject({ value: 10.5, accn: "new", restatedFrom: { value: 10, accn: "old" } });
  });

  it("never derives non-additive metrics such as weighted shares from year-to-date values", () => {
    const shares = [fact("2025-07-01", "2025-09-30", 7.46), fact("2025-07-01", "2025-12-31", 7.45)];
    expect(quarterlySeries([["WeightedAverageNumberOfDilutedSharesOutstanding", shares]], { additive: false }).map((x) => x.end)).toEqual(["2025-09-30"]);
  });

  it("ignores non-periodic forms such as 8-K", () => {
    expect(quarterlySeries([["Revenues", [fact("2026-01-01", "2026-03-31", 10, "8-K")]]])).toEqual([]);
  });
});

describe("annual, instant and checks", () => {
  it("reads 20-F annual values", () => {
    expect(annualSeries([["Revenue", [fact("2024-01-01", "2024-12-31", 2894, "20-F")]]])[0]).toMatchObject({ end: "2024-12-31", value: 2894 });
  });

  it("reads balance-sheet instants", () => {
    expect(instantSeries([["InventoryNet", [fact(undefined, "2026-07-26", 12.1)]]])[0]).toMatchObject({ end: "2026-07-26", value: 12.1 });
  });

  it("checks quarters against the originally filed annual value, not a later restatement", () => {
    const quarters = quarterlySeries([["Revenues", [fact("2016-01-01", "2016-03-31", 20), fact("2016-04-01", "2016-06-30", 20), fact("2016-07-01", "2016-09-30", 20), fact("2016-10-01", "2016-12-31", 20)]]]);
    const annualFacts: Fact[] = [fact("2016-01-01", "2016-12-31", 80, "10-K", "2017-02-01", "orig"), fact("2016-01-01", "2016-12-31", 85, "10-K", "2018-02-01", "restated")];
    expect(checkFourQuarters(quarters, annualSeries([["Revenues", annualFacts]]))).toHaveLength(1);
    expect(checkFourQuarters(quarters, annualSeries([["Revenues", annualFacts]], { original: true }))).toEqual([]);
  });

  it("passes when either the restated or the original figures are internally consistent", () => {
    // 原始：四季 20×4 = 年报 80；后来重述：年报 85、季度也重述为 21.25×4
    const q = (v: number, filed: string): Fact[] => ["03-31", "06-30", "09-30", "12-31"].map((e, i) => fact(`2016-${["01-01", "04-01", "07-01", "10-01"][i]}`, `2016-${e}`, v, "10-Q", filed, filed));
    const restatedConsistently = [...q(20, "2016-12-01"), ...q(21.25, "2018-01-01"), fact("2016-01-01", "2016-12-31", 80, "10-K", "2017-02-01"), fact("2016-01-01", "2016-12-31", 85, "10-K", "2018-02-01")];
    expect(consistentMismatches([["Revenues", restatedConsistently]])).toEqual([]);
    const broken = [...q(20, "2016-12-01"), fact("2016-01-01", "2016-12-31", 95, "10-K", "2017-02-01")];
    expect(consistentMismatches([["Revenues", broken]])).toHaveLength(1);
  });

  it("flags quarters that do not add up to the annual report", () => {
    const quarters = quarterlySeries([["Revenues", [fact("2025-01-01", "2025-03-31", 1), fact("2025-04-01", "2025-06-30", 1), fact("2025-07-01", "2025-09-30", 1), fact("2025-10-01", "2025-12-31", 1)]]]);
    expect(checkFourQuarters(quarters, [{ ...quarters[0]!, start: "2025-01-01", end: "2025-12-31", value: 5 }])).toHaveLength(1);
  });

  it("assigns fiscal quarters to calendar quarters by their midpoint", () => {
    expect(["2025-09-30", "2025-08-31", "2025-11-30", "2026-02-28", "2025-10-26", "2026-01-25"].map(calendarQuarter)).toEqual(["2025Q3", "2025Q3", "2025Q4", "2026Q1", "2025Q3", "2025Q4"]);
  });
});
