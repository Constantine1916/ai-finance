import { describe, expect, it } from "vitest";
import { aggregateByCalendarQuarter, historyRange, quarterEndDate, threeMonthYoY, valuationSeries } from "@/ai/metrics";

const o = (obsDate: string, value: number) => ({ obsDate, value });

describe("hyperscaler capex aggregate", () => {
  it("aligns fiscal quarters (Microsoft June year, Oracle May year) to calendar quarters", () => {
    const r = aggregateByCalendarQuarter({
      MSFT: [o("2025-09-30", 19), o("2026-09-30", 30)],
      ORCL: [o("2025-08-31", 8), o("2026-08-31", 28)],
    });
    expect(r.map((q) => [q.cq, q.total])).toEqual([["2025Q3", 27], ["2026Q3", 58]]);
    expect(r[1]!.yoy).toBeCloseTo((58 / 27 - 1) * 100);
  });

  it("marks a quarter incomplete when a member has not reported, and skips its growth", () => {
    const r = aggregateByCalendarQuarter({ MSFT: [o("2026-09-30", 30)], META: [] });
    expect(r[0]).toMatchObject({ cq: "2026Q3", total: null, missing: ["META"], yoy: null });
  });

  it("maps calendar quarters to quarter-end dates", () => {
    expect(quarterEndDate("2026Q1")).toBe("2026-03-31");
    expect(quarterEndDate("2025Q4")).toBe("2025-12-31");
  });
});

describe("TSMC three-month YoY", () => {
  it("compares the latest three months with the same months a year earlier", () => {
    const months = Array.from({ length: 15 }, (_, i) => o(new Date(Date.UTC(2025, i, 1)).toISOString().slice(0, 10), i < 12 ? 100 : 150));
    const r = threeMonthYoY(months);
    expect(r.at(-1)!.value).toBeCloseTo(50);
    expect(r[13]!.value).toBeNull(); // 去年同期数据不全
  });
});

describe("valuation", () => {
  const base = {
    splits: [] as { obsDate: string; value: number }[],
    netIncome: [o("2025-03-31", 10), o("2025-06-30", 10), o("2025-09-30", 10), o("2025-12-31", 10)],
    shares: [o("2025-12-31", 100)],
    equity: [o("2025-12-31", 400)],
  };

  it("uses only data available 60 days after the period end", () => {
    const early = valuationSeries({ ...base, closes: [o("2026-01-15", 4)] }, "daily");
    expect(early[0]!.peStatus).toBe("missing"); // 2025-12-31 的数据在 2026-03-01 才视为可得
    const later = valuationSeries({ ...base, closes: [o("2026-03-02", 4)] }, "daily");
    expect(later[0]).toMatchObject({ pe: 10, pb: 1, peStatus: "ok" }); // 市值 400 / TTM 40
  });

  it("reports losses as not applicable instead of a negative ratio", () => {
    const r = valuationSeries({ ...base, netIncome: base.netIncome.map((x) => ({ ...x, value: -1 })), closes: [o("2026-03-02", 4)] }, "daily");
    expect(r[0]).toMatchObject({ pe: null, peStatus: "loss", pbStatus: "ok" });
  });

  it("scales share counts by later splits so market cap stays continuous", () => {
    const pre = valuationSeries({ ...base, closes: [o("2026-03-02", 40)] }, "daily")[0]!;
    const post = valuationSeries({ ...base, splits: [o("2026-03-03", 10)], closes: [o("2026-03-03", 4)] }, "daily")[0]!;
    expect(post.pe).toBeCloseTo(pre.pe! / 1); // 拆股后价格变为 1/10、股数 ×10，市盈率不变
  });

  it("summarizes the history range and current percentile", () => {
    expect(historyRange([10, 20, 30, 40])).toMatchObject({ min: 10, median: 30, max: 40, percentile: 100 });
    expect(historyRange([null, null])).toBeNull();
  });
});
