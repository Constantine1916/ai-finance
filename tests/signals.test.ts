import { describe, expect, it } from "vitest";
import type { Point } from "@/pipeline/derived";
import { quadrantName, quadrantTrail } from "@/signals/quadrant";
import { defaultParams, RULE_MAP, triggerDates, type DailyState } from "@/signals/rules";
import { forwardStats, summarize } from "@/signals/track";

const rule = (id: string) => RULE_MAP.get(id)!;
const run = (id: string, data: Record<string, Point[]>, overrides: Record<string, number> = {}) => rule(id).evaluate(data, { ...defaultParams(rule(id)), ...overrides });
const daily = (values: number[], start = "2020-01-01"): Point[] => values.map((value, i) => ({ date: new Date(Date.parse(start) + i * 86_400_000).toISOString().slice(0, 10), value }));
const states = (r: DailyState[]) => r.map((s) => s.state);

describe("curve un-inversion", () => {
  it("watches during an inversion and warns once the turn positive is confirmed", () => {
    const r = run("curve-uninversion", { spread: daily([...Array(60).fill(-0.5), ...Array(20).fill(0.2)]) });
    expect(r[0]!.state).toBe("watch");
    expect(r[78]!.state).toBe("watch"); // 第 19 个正值日，转正尚未确认
    expect(r[79]!.state).toBe("warning");
  });

  it("does not reset the inversion count on brief positive days", () => {
    const choppy = [...Array(40).fill(-0.3), 0.1, 0.1, ...Array(30).fill(-0.2), ...Array(20).fill(0.3)];
    expect(run("curve-uninversion", { spread: daily(choppy) }).at(-1)!.state).toBe("warning");
  });

  it("ignores a short inversion", () => {
    expect(run("curve-uninversion", { spread: daily([...Array(10).fill(-0.5), ...Array(25).fill(0.1)]) }).at(-1)!.state).toBe("normal");
  });

  it("stops warning after the configured months", () => {
    const r = run("curve-uninversion", { spread: daily([...Array(60).fill(-0.5), ...Array(420).fill(0.5)]) }, { warnMonths: 12 });
    expect(r[79]!.state).toBe("warning");
    expect(r.at(-1)!.state).toBe("normal");
  });
});

describe("threshold rules", () => {
  it("high-yield spread: change over 63 trading days", () => {
    const flat = Array(63).fill(3);
    expect(run("hy-spread-widening", { oas: daily([...flat, 4.1]) }).at(-1)).toMatchObject({ state: "warning" });
    expect(run("hy-spread-widening", { oas: daily([...flat, 3.6]) }).at(-1)).toMatchObject({ state: "watch" });
    expect(run("hy-spread-widening", { oas: daily([...flat, 3.2]) }).at(-1)).toMatchObject({ state: "normal" });
  });

  it("Sahm rule uses >= thresholds", () => {
    expect(states(run("sahm", { sahm: daily([0.5, 0.3, 0.29]) }))).toEqual(["warning", "watch", "normal"]);
  });

  it("claims: 4-week average versus the 52-week low", () => {
    const base = Array(55).fill(200_000);
    expect(run("claims-rise", { claims: daily([...base, 260_000, 260_000, 260_000, 260_000]) }).at(-1)).toMatchObject({ state: "warning" });
    expect(run("claims-rise", { claims: daily([...base, 230_000, 230_000, 230_000, 230_000]) }).at(-1)).toMatchObject({ state: "watch" });
  });

  it("NFCI above zero is tight", () => {
    expect(states(run("nfci", { nfci: daily([0.1, -0.1, -0.5]) }))).toEqual(["warning", "watch", "normal"]);
  });

  it("SPY versus its 200-day average", () => {
    const r = run("spy-200dma", { price: daily([99, 101, 105]), ma: daily([100, 100, 100]) });
    expect(states(r)).toEqual(["warning", "watch", "normal"]);
    expect(r[0]!.value).toBeCloseTo(-1);
  });

  it("VIX term structure", () => {
    expect(states(run("vix-term", { ratio: daily([1.05, 0.97, 0.9]) }))).toEqual(["warning", "watch", "normal"]);
  });

  it("oil year-over-year skips dates without a nearby base a year earlier", () => {
    const wti = [{ date: "2025-01-02", value: 60 }, { date: "2026-01-02", value: 95 }, { date: "2026-03-01", value: 70 }];
    const r = run("oil-shock", { wti });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ date: "2026-01-02", state: "warning" });
  });

  it("real rate jump over 63 trading days", () => {
    expect(run("real-rate-jump", { real: daily([...Array(63).fill(1.5), 2.3]) }).at(-1)).toMatchObject({ state: "warning" });
  });
});

describe("triggers and track record", () => {
  it("counts entries into warning with a cooldown", () => {
    const s = (date: string, state: DailyState["state"]): DailyState => ({ date, value: 0, state });
    expect(triggerDates([s("2020-01-01", "warning"), s("2020-01-02", "normal"), s("2020-02-01", "warning"), s("2020-06-01", "normal"), s("2020-07-01", "warning")])).toEqual(["2020-01-01", "2020-07-01"]);
  });

  it("computes forward returns and reports missing history as null", () => {
    const prices = daily(Array.from({ length: 300 }, (_, i) => 100 + i));
    const f = forwardStats(prices[0]!.date, prices);
    expect(f.r3m).toBeCloseTo(63);
    expect(f.r12m).toBeCloseTo(252);
    expect(f.maxDrop12m).toBeCloseTo(0);
    const late = forwardStats(prices[200]!.date, prices); // 价格 300，63 天后 363；12 个月后超出数据范围
    expect(late.r3m).toBeCloseTo(21);
    expect(late).toMatchObject({ r12m: null, maxDrop12m: null });
    expect(forwardStats("1990-01-01", prices).r3m).toBeNull(); // 触发早于价格数据
  });

  it("summarizes only fully evaluated triggers", () => {
    expect(summarize([{ r3m: 1, r6m: 1, r12m: -5, maxDrop12m: -9 }, { r3m: 1, r6m: 1, r12m: 10, maxDrop12m: -2 }, { r3m: 1, r6m: null, r12m: null, maxDrop12m: null }])).toEqual({ total: 3, evaluated: 2, negative12m: 1, median12m: 2.5 });
  });
});

describe("cycle quadrant", () => {
  it("names the four quadrants", () => {
    expect([quadrantName(1, 1), quadrantName(1, -1), quadrantName(-1, 1), quadrantName(-1, -1)]).toEqual(["过热", "复苏", "滞胀", "衰退"]);
  });

  it("uses only months available on both axes, without extrapolating", () => {
    const months = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => ({ date: `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`, value: f(i) }));
    const industrial = months(24, (i) => 100 + i); // 到 2025-12
    const cpi = months(22, (i) => 100 * 1.003 ** i); // 只到 2025-10
    const trail = quadrantTrail(industrial, cpi);
    expect(trail.at(-1)!.date).toBe("2025-10-01");
    expect(trail.every((p) => Number.isFinite(p.growth) && Number.isFinite(p.inflation))).toBe(true);
  });
});
