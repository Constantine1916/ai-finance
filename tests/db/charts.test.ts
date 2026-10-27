import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildChart, derivedInputs } from "@/macro/build";
import type { ChartSpec } from "@/macro/charts";
import { upsertSeries, writeObservations } from "@/pipeline/store";
import type { SeriesDef } from "@/pipeline/types";
import { testDb } from "./helpers";

const { db, close } = testDb();
afterAll(close);

const now = new Date("2026-10-27T12:00:00Z");
const def = (id: string, frequency: SeriesDef["frequency"] = "daily"): SeriesDef => ({ id, source: id.split(":")[0]!, sourceKey: id.split(":")[1]!, nameZh: id, unit: "Percent", frequency, category: "x" });
const obs = (rows: [string, number][]) => rows.map(([obsDate, value]) => ({ obsDate, value, unit: "Percent", sourceRef: "https://example.org", fetchedAt: new Date("2026-10-27T00:00:00Z") }));
const days = (start: string, n: number, f: (i: number) => number): [string, number][] =>
  Array.from({ length: n }, (_, i) => [new Date(Date.parse(start) + i * 86_400_000).toISOString().slice(0, 10), f(i)]);

beforeAll(async () => {
  await upsertSeries(db, [def("cfred:Y10"), def("ctreasury:Y10"), def("cfred:SPREAD"), def("cfred:SHORT"), def("cfred:IDX"), def("cfred:CPI", "monthly")]);
  await writeObservations(db, def("cfred:Y10"), obs([["2026-10-21", 4.9], ["2026-10-22", 4.96]]));
  await writeObservations(db, def("ctreasury:Y10"), obs([["2026-10-22", 4.96], ["2026-10-23", 5.0]]));
  await writeObservations(db, def("cfred:SPREAD"), obs([["2026-10-01", 0.3], ["2026-10-02", -0.1], ["2026-10-05", -0.2]]));
  await writeObservations(db, def("cfred:SHORT"), obs(days("2023-10-27", 30, () => 3)));
  await writeObservations(db, def("cfred:IDX"), obs(days("2016-01-01", 3000, (i) => 100 + i)));
  await writeObservations(db, def("cfred:CPI", "monthly"), obs([["2025-09-01", 100], ["2026-06-01", 102], ["2026-09-01", 103]]));
});

describe("buildChart", () => {
  it("extends FRED history with the newer Treasury day without duplicating dates", async () => {
    const spec: ChartSpec = { id: "t1", title: "", unit: "%", lines: [{ label: "10Y", series: "cfred:Y10", newer: "ctreasury:Y10" }] };
    const data = await buildChart(db, spec, "1y", now);
    expect(data.lines[0]!.points).toEqual([["2026-10-21", 4.9], ["2026-10-22", 4.96], ["2026-10-23", 5]]);
    expect(data.historyLimited.map((h) => h.label)).toEqual(["cfred:Y10"]); // 测试数据只有两天；补充来源不算
  });

  it("reports when the current inversion began", async () => {
    const spec: ChartSpec = { id: "t2", title: "", unit: "", lines: [{ label: "s", series: "cfred:SPREAD" }], annotations: [{ kind: "shade-below", value: 0, label: "倒挂" }] };
    expect((await buildChart(db, spec, "1y", now)).events).toEqual(["倒挂：当前处于倒挂，始于 2026-10-02"]);
  });

  it("flags a source whose history is shorter than the range", async () => {
    const spec: ChartSpec = { id: "t3", title: "", unit: "", lines: [{ label: "s", series: "cfred:SHORT" }] };
    expect((await buildChart(db, spec, "10y", now)).historyLimited).toEqual([{ label: "cfred:SHORT", firstObsDate: "2023-10-27" }]);
    expect((await buildChart(db, spec, "1y", now)).historyLimited).toEqual([]);
  });

  it("downsamples long ranges and indexes comparison charts to 100", async () => {
    const spec: ChartSpec = { id: "indices", title: "", unit: "", lines: [{ label: "i", series: "cfred:IDX" }] };
    const data = await buildChart(db, spec, "max", now);
    expect(data.downsampled).toBe("month");
    expect(data.lines[0]!.points.length).toBeLessThan(120);
    expect(data.lines[0]!.points[0]![1]).toBe(100);
  });

  it("keeps a missing year-over-year base as missing", async () => {
    const spec: ChartSpec = { id: "t5", title: "", unit: "%", lines: [{ label: "yoy", series: "cfred:CPI", transform: "yoy" }] };
    const points = (await buildChart(db, spec, "max", now)).lines[0]!.points;
    expect(points).toEqual([["2025-09-01", null], ["2026-06-01", null], ["2026-09-01", 3]]);
  });

  it("maps derived series to their inputs for provenance", () => {
    expect(derivedInputs("ratio:HYG/IEF")).toEqual(["tiingo:HYG:close", "tiingo:IEF:close"]);
    expect(derivedInputs("sma200:SPY")).toEqual(["tiingo:SPY:close"]);
    expect(derivedInputs("net-liquidity")).toEqual(["fred:WALCL", "fred:WTREGEN", "fred:RRPONTSYD"]);
  });
});
