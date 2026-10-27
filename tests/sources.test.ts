import { afterEach, describe, expect, it, vi } from "vitest";
import { netLiquidity } from "@/jobs/derive";
import { adjustedClose } from "@/pipeline/adjust";
import { RetryableError } from "@/pipeline/ingest";
import { isDue } from "@/pipeline/schedule";
import type { SeriesDef } from "@/pipeline/types";
import { beaAdapter } from "@/sources/bea";
import { blsAdapter } from "@/sources/bls";
import { fetchQuotes } from "@/sources/finnhub";
import { fredAdapter } from "@/sources/fred";
import { requestJson } from "@/sources/http";
import { tiingoAdapter } from "@/sources/tiingo";
import { parseTreasuryCsv } from "@/sources/treasury";

// 以下均为模拟响应，验证解析逻辑；真实供应商采集结果记录在 docs/verification.md
const ctx = { credential: "secret-key-value", signal: AbortSignal.timeout(5000) };
const def = (id: string, sourceKey: string, unit = "Percent"): SeriesDef => ({ id, source: id.split(":")[0]!, sourceKey, nameZh: id, unit, frequency: "daily", category: "x" });
const mockFetch = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

afterEach(() => vi.restoreAllMocks());

describe("http errors", () => {
  it("retries 429 and 5xx but not 4xx, and never echoes the URL", async () => {
    mockFetch({}, 429);
    await expect(requestJson("FRED", "https://x/?api_key=secret-key-value", { signal: ctx.signal })).rejects.toBeInstanceOf(RetryableError);
    vi.restoreAllMocks();
    mockFetch({}, 400);
    const error = (await requestJson("FRED", "https://x/?api_key=secret-key-value", { signal: ctx.signal }).catch((e: unknown) => e)) as Error;
    expect(error).not.toBeInstanceOf(RetryableError);
    expect(String(error.message)).not.toContain("secret-key-value");
  });
});

describe("adapters", () => {
  it("FRED skips '.' placeholders instead of recording zero", async () => {
    mockFetch({ observations: [{ date: "2026-10-12", value: "." }, { date: "2026-10-13", value: "4.05" }] });
    const rows = await fredAdapter().fetchSeries(def("fred:DGS10", "DGS10"), ctx);
    expect(rows.map((r) => [r.obsDate, r.value])).toEqual([["2026-10-13", 4.05]]);
    expect(rows[0]!.sourceRef).toBe("https://fred.stlouisfed.org/series/DGS10");
  });

  it("parses the Treasury CSV", () => {
    const rows = parseTreasuryCsv('Date,"3 Mo","10 Yr"\n10/23/2026,4.22,5.00\n10/22/2026,N/A,4.96\n');
    expect(rows.get("2026-10-23")?.get("10 Yr")).toBe(5);
    expect(rows.get("2026-10-22")?.has("3 Mo")).toBe(false);
  });

  it("BLS drops annual averages and maps months", async () => {
    mockFetch({ status: "REQUEST_SUCCEEDED", Results: { series: [{ seriesID: "CUSR0000SA0", data: [{ year: "2026", period: "M09", value: "339.3" }, { year: "2025", period: "M13", value: "330" }] }] } });
    const rows = await blsAdapter(["CUSR0000SA0"]).fetchSeries(def("bls:CUSR0000SA0", "CUSR0000SA0", "Index"), ctx);
    expect(rows.map((r) => [r.obsDate, r.value])).toEqual([["2026-09-01", 339.3]]);
  });

  it("BEA selects rows by series code, not by name", async () => {
    mockFetch({ BEAAPI: { Results: { Data: [
      { SeriesCode: "DPCCRG", TimePeriod: "2026M08", DataValue: "130.455" },
      { SeriesCode: "DPCXRG", TimePeriod: "2026M08", DataValue: "127.829" },
    ] } } });
    const rows = await beaAdapter().fetchSeries(def("bea:DPCCRG", "T20804:DPCCRG", "Index"), ctx);
    expect(rows.map((r) => [r.obsDate, r.value])).toEqual([["2026-08-01", 130.455]]);
  });

  it("BEA reports an inactive key as an error", async () => {
    mockFetch({ BEAAPI: { Results: { Error: { APIErrorDescription: "This UserId is not active." } } } });
    await expect(beaAdapter().fetchSeries(def("bea:DPCCRG", "T20804:DPCCRG"), ctx)).rejects.toThrow(/not active/);
  });

  it("Tiingo shares one request across close, dividend and split series", async () => {
    const spy = mockFetch([
      { date: "2024-06-07T00:00:00.000Z", close: 1208.88, divCash: 0, splitFactor: 1 },
      { date: "2024-06-10T00:00:00.000Z", close: 121.79, divCash: 0, splitFactor: 10 },
      { date: "2024-06-11T00:00:00.000Z", close: 120.91, divCash: 0.01, splitFactor: 1 },
    ]);
    const a = tiingoAdapter();
    const close = await a.fetchSeries(def("tiingo:NVDA:close", "NVDA:close", "USD"), ctx);
    const split = await a.fetchSeries(def("tiingo:NVDA:split", "NVDA:split", "Ratio"), ctx);
    const div = await a.fetchSeries(def("tiingo:NVDA:div", "NVDA:div", "USD per share"), ctx);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(close).toHaveLength(3);
    expect(split.map((r) => [r.obsDate, r.value])).toEqual([["2024-06-10", 10]]);
    expect(div.map((r) => [r.obsDate, r.value])).toEqual([["2024-06-11", 0.01]]);
    const auth = (spy.mock.calls[0]![1]!.headers as Record<string, string>).Authorization;
    expect(auth).toBe("Token secret-key-value");
    expect(String(spy.mock.calls[0]![0])).not.toContain("secret-key-value");
  });

  it("Tiingo keeps the first start date even after the close series is written mid-run", async () => {
    const spy = mockFetch([{ date: "2001-01-02T00:00:00.000Z", close: 100, divCash: 0.5, splitFactor: 1 }]);
    const stored: { last?: string } = {};
    const a = tiingoAdapter({ lastObsDate: async () => stored.last });
    await a.fetchSeries(def("tiingo:SPY:close", "SPY:close", "USD"), ctx);
    stored.last = "2026-10-23"; // 模拟收盘价已写入数据库
    const div = await a.fetchSeries(def("tiingo:SPY:div", "SPY:div", "USD per share"), ctx);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]![0])).toContain("startDate=2000-01-01");
    expect(div).toHaveLength(1);
  });

  it("Finnhub treats a zero price as no coverage, not a price of 0", async () => {
    mockFetch({ c: 0, t: 0 });
    const { snapshots, errors } = await fetchQuotes(["XYZ"], "k", ctx.signal);
    expect(snapshots).toEqual([]);
    expect(errors[0]).toContain("无报价");
  });
});

describe("adjustedClose", () => {
  it("keeps prices continuous across a 10-for-1 split", () => {
    const adj = adjustedClose(
      [{ obsDate: "2024-06-07", value: 1208.88 }, { obsDate: "2024-06-10", value: 121.79 }],
      [],
      [{ obsDate: "2024-06-10", value: 10 }],
    );
    expect(adj[0]!.value).toBeCloseTo(120.888);
    expect(adj[1]!.value).toBe(121.79);
  });

  it("scales prices before an ex-dividend date", () => {
    const adj = adjustedClose([{ obsDate: "d1", value: 100 }, { obsDate: "d2", value: 99 }], [{ obsDate: "d2", value: 1 }], []);
    expect(adj[0]!.value).toBeCloseTo(99);
  });
});

describe("netLiquidity", () => {
  it("converts millions and billions before subtracting", () => {
    const r = netLiquidity([{ date: "2026-10-21", value: 6_753_604 }], [{ date: "2026-10-21", value: 952_002 }], [{ date: "2026-10-20", value: 0.2 }]);
    expect(r[0]!.value).toBeCloseTo(6753.604 - 952.002 - 0.2);
  });

  it("leaves the week missing when the reverse repo value is too old", () => {
    expect(netLiquidity([{ date: "2026-10-21", value: 1 }], [{ date: "2026-10-21", value: 1 }], [{ date: "2026-10-01", value: 0.2 }])[0]!.value).toBeNull();
  });
});

describe("window trigger", () => {
  const t = { kind: "window", start: "16:00", end: "20:00", minutes: 15, tradingDaysOnly: true } as const;
  it("runs only inside the Eastern window on trading days", () => {
    expect(isDue(t, new Date("2026-10-26T19:59:00Z"), undefined)).toBe(false); // 15:59 EDT
    expect(isDue(t, new Date("2026-10-26T20:00:00Z"), undefined)).toBe(true);
    expect(isDue(t, new Date("2026-10-26T20:10:00Z"), new Date("2026-10-26T20:00:00Z"))).toBe(false);
    expect(isDue(t, new Date("2026-10-27T00:01:00Z"), undefined)).toBe(false); // 20:01 EDT
    expect(isDue(t, new Date("2026-10-24T20:30:00Z"), undefined)).toBe(false); // 周六
  });
});
