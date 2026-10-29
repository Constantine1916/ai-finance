import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { companies, observationRevisions, pendingObservations, universeChanges, universeMembers } from "@/db/schema";
import { addMember, activeMembers, ensureDefaultUniverse, removeMember, updateMember } from "@/ai/universe";
import { DEFAULT_UNIVERSE } from "@/ai/companies";
import { ingestCompanyFacts } from "@/jobs/edgar";
import { applyReport, TSMC_REVENUE } from "@/jobs/tsmc";
import { confirmPending } from "@/pipeline/store";
import { readSeries, upsertSeries } from "@/pipeline/store";
import type { CompanyFacts, Fact } from "@/sources/edgar";
import { testDb } from "./helpers";

const { db, close } = testDb();
afterAll(close);

const f = (start: string | undefined, end: string, val: number, form = "10-Q", accn = "0001-26-000001", filed = "2026-01-01"): Fact => ({ start, end, val, form, accn, filed });
const facts = (gaap: Record<string, Fact[]>, unit = "USD"): CompanyFacts => ({ cik: 1, entityName: "Test", facts: { "us-gaap": Object.fromEntries(Object.entries(gaap).map(([k, v]) => [k, { units: { [unit]: v } }])) } });
const recent = (y: number) => [f(`${y}-01-01`, `${y}-03-31`, 10), f(`${y}-04-01`, `${y}-06-30`, 11), f(`${y}-07-01`, `${y}-09-30`, 12), f(`${y}-10-01`, `${y}-12-31`, 13, "10-K"), f(`${y}-01-01`, `${y}-12-31`, 46, "10-K")];

describe("EDGAR ingest", () => {
  it("writes quarters, derives cash-flow quarters and holds a mismatching fiscal year for review", async () => {
    const thisYear = new Date().getUTCFullYear() - 1;
    const cf = facts({
      Revenues: [...recent(thisYear), ...recent(thisYear - 1).map((x) => (x.end.endsWith("12-31") && x.start?.endsWith("01-01") ? { ...x, val: 99 } : x))],
      PaymentsToAcquirePropertyPlantAndEquipment: [f(`${thisYear}-01-01`, `${thisYear}-03-31`, 2), f(`${thisYear}-01-01`, `${thisYear}-06-30`, 5)],
      NetIncomeLoss: [f(`${thisYear}-01-01`, `${thisYear}-03-31`, 3, "10-Q", "old"), f(`${thisYear}-01-01`, `${thisYear}-03-31`, 4, "10-Q/A", "new", "2026-06-01")],
    });
    const r = await ingestCompanyFacts(db, "TSTA", "1", cf);
    expect(r.mode).toBe("quarterly");
    expect((await readSeries(db, "edgar:TSTA:revenue")).length).toBe(4); // 当年 4 季；上一年因年报不一致被搁置
    const held = await db.select().from(pendingObservations).where(eq(pendingObservations.seriesId, "edgar:TSTA:revenue"));
    expect(held).toHaveLength(4);
    expect((held[0]!.issues as { code: string }[])[0]!.code).toBe("four_quarter_mismatch");
    expect((await readSeries(db, "edgar:TSTA:capex")).map((p) => p.value)).toEqual([2, 3]);
    const revisions = await db.select().from(observationRevisions).where(eq(observationRevisions.seriesId, "edgar:TSTA:netIncome"));
    expect(revisions.map((x) => x.previousValue)).toEqual([3]);
    await ingestCompanyFacts(db, "TSTA", "1", cf); // 再次处理不重复记录重述
    expect((await db.select().from(observationRevisions).where(eq(observationRevisions.seriesId, "edgar:TSTA:netIncome"))).length).toBe(1);
  });

  it("keeps owner-confirmed quarters confirmed on later ingests unless the value changes", async () => {
    const y = new Date().getUTCFullYear() - 1; // 需在最近两年内，否则按外国申报（年度）口径处理
    const bad = recent(y).map((x) => (x.end.endsWith("12-31") && x.start?.endsWith("01-01") ? { ...x, val: 99 } : x));
    await ingestCompanyFacts(db, "TSTC", "3", facts({ Revenues: bad }));
    const pending = await db.select().from(pendingObservations).where(eq(pendingObservations.seriesId, "edgar:TSTC:revenue"));
    expect(pending).toHaveLength(4);
    for (const p of pending) await confirmPending(db, p.seriesId, p.obsDate);
    await ingestCompanyFacts(db, "TSTC", "3", facts({ Revenues: bad }));
    expect(await db.select().from(pendingObservations).where(eq(pendingObservations.seriesId, "edgar:TSTC:revenue"))).toHaveLength(0);
    const changed = bad.map((x) => (x.end === `${y}-03-31` && x.start === `${y}-01-01` ? { ...x, val: 10.5, filed: "2027-01-01" } : x));
    await ingestCompanyFacts(db, "TSTC", "3", facts({ Revenues: changed }));
    expect((await db.select().from(pendingObservations).where(eq(pendingObservations.seriesId, "edgar:TSTC:revenue"))).map((p) => p.obsDate)).toEqual([`${y}-03-31`]);
  });

  it("stores annual series in the reporting currency for 20-F filers", async () => {
    const cf = facts({ Revenue: [f("2023-01-01", "2023-12-31", 2161, "20-F"), f("2024-01-01", "2024-12-31", 2894, "20-F")] }, "TWD");
    const r = await ingestCompanyFacts(db, "TSTB", "2", cf);
    expect(r).toMatchObject({ mode: "annual", currency: "TWD" });
    expect((await readSeries(db, "edgar:TSTB:revenue:fy")).map((p) => p.value)).toEqual([2161, 2894]);
  });
});

describe("universe", () => {
  const lookup = async (s: string) => (s === "NOPE" ? undefined : { cik: String(1000 + s.length), name: `${s} Inc` });
  const budget = (n: number) => ({ ok: n <= 22, message: `超出额度（${n}）` });

  it("seeds the default universe once", async () => {
    expect(await ensureDefaultUniverse(db, lookup)).toBe(DEFAULT_UNIVERSE.length);
    expect(await ensureDefaultUniverse(db, lookup)).toBe(0);
    expect((await activeMembers(db)).filter((m) => m.inHyperscalerCapex).map((m) => m.symbol).sort()).toEqual(["AMZN", "GOOGL", "META", "MSFT", "ORCL"]);
  });

  it("rejects unknown symbols and configurations over the request budget", async () => {
    await expect(addMember(db, { symbol: "NOPE", layer: "compute", cyclicality: "growth", inHyperscalerCapex: false }, lookup, budget)).rejects.toThrow(/找不到/);
    await addMember(db, { symbol: "INTC", layer: "compute", cyclicality: "strong", inHyperscalerCapex: false }, lookup, budget);
    await expect(addMember(db, { symbol: "QCOM", layer: "compute", cyclicality: "growth", inHyperscalerCapex: false }, lookup, budget)).rejects.toThrow(/超出额度/);
  });

  it("keeps history when a member is removed and re-added, and logs every change", async () => {
    await upsertSeries(db, [TSMC_REVENUE]);
    await removeMember(db, "INTC");
    expect((await activeMembers(db)).some((m) => m.symbol === "INTC")).toBe(false);
    expect((await db.select().from(companies).where(eq(companies.symbol, "INTC"))).length).toBe(1);
    await addMember(db, { symbol: "intc", layer: "compute", cyclicality: "strong", inHyperscalerCapex: false }, lookup, budget);
    await updateMember(db, "INTC", { layer: "foundry-equipment" });
    const [row] = await db.select().from(universeMembers).where(eq(universeMembers.symbol, "INTC"));
    expect(row).toMatchObject({ active: true, layer: "foundry-equipment" });
    const log = await db.select().from(universeChanges).where(eq(universeChanges.symbol, "INTC"));
    expect(log.map((l) => l.action)).toEqual(["add", "remove", "readd", "update"]);
  });
});

describe("TSMC monthly revenue", () => {
  const report = (month: string, current: number, priorMonth: number, yearAgo: number) => ({ month, current, priorMonth, yearAgo, ytd: 0, ytdPriorYear: 0 });

  it("fills current, prior and year-ago months, then flags a later report that disagrees", async () => {
    await upsertSeries(db, [TSMC_REVENUE]);
    await applyReport(db, report("2026-08-01", 514806, 500000, 300000), "https://example.org/aug");
    expect((await readSeries(db, "tsmc:revenue")).map((p) => [p.obsDate, p.value])).toEqual([["2025-08-01", 300000], ["2026-07-01", 500000], ["2026-08-01", 514806]]);
    const notes = await applyReport(db, report("2026-09-01", 511857, 514000, 330980), "https://example.org/sep");
    expect(notes.join()).toContain("2026-08 不一致");
    const [pending] = await db.select().from(pendingObservations).where(eq(pendingObservations.seriesId, "tsmc:revenue"));
    expect(pending).toMatchObject({ obsDate: "2026-08-01", value: 514000 });
    expect((await readSeries(db, "tsmc:revenue")).find((p) => p.obsDate === "2026-08-01")!.value).toBe(514806);
  });
});
