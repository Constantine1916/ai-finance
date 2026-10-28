import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/types";
import { filings, ingestRuns, observationRevisions, pendingObservations } from "@/db/schema";
import { conceptsFor, METRICS, type Metric } from "@/ai/companies";
import { annualSeries, consistentMismatches, instantSeries, quarterlySeries, type PeriodValue } from "@/ai/extract";
import { activeMembers } from "@/ai/universe";
import { upsertSeries, writeObservations } from "@/pipeline/store";
import type { SeriesDef } from "@/pipeline/types";
import { fetchCompanyFacts, fetchFilings, filingUrl, PERIODIC_FORMS, type CompanyFacts, type Fact } from "@/sources/edgar";

export const edgarSeriesId = (symbol: string, metric: Metric, annual = false) => `edgar:${symbol}:${metric}${annual ? ":fy" : ""}`;

function seriesDef(symbol: string, metric: Metric, unit: string, annual: boolean): SeriesDef {
  const m = METRICS[metric];
  return {
    id: edgarSeriesId(symbol, metric, annual),
    source: "edgar",
    sourceKey: `${symbol}:${metric}${annual ? ":fy" : ""}`,
    nameZh: `${symbol} ${m.name}（${m.kind === "instant" ? "期末" : annual ? "年度" : "单季"}）`,
    unit,
    frequency: annual ? "annual" : "quarterly",
    category: "fundamentals",
    releaseLagDays: annual ? 120 : 45,
  };
}

function flatten(cf: CompanyFacts): Record<string, Record<string, Fact[]>> {
  return Object.assign({}, ...Object.values(cf.facts).map((t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.units]))));
}

export interface CompanyResult {
  symbol: string;
  mode: "quarterly" | "annual";
  currency: string;
  written: number;
  pending: number;
  mismatches: string[];
}

// 处理一家公司的全部指标：外国申报公司（只有 20-F）存年度序列
export async function ingestCompanyFacts(db: Db, symbol: string, cik: string, cf: CompanyFacts): Promise<CompanyResult> {
  const facts = flatten(cf);
  const input = (metric: Metric) =>
    conceptsFor(symbol, metric)
      .filter((c) => facts[c])
      .map((c) => [c, Object.values(facts[c]!)[0]!] as [string, Fact[]]);
  const revenueUnit = Object.keys(facts[conceptsFor(symbol, "revenue").find((c) => facts[c]) ?? ""] ?? {})[0] ?? "USD";
  const twoYearsAgo = new Date(Date.now() - 730 * 86_400_000).toISOString().slice(0, 10);
  const mode = quarterlySeries(input("revenue")).some((q) => q.end >= twoYearsAgo) ? "quarterly" : "annual";
  const result: CompanyResult = { symbol, mode, currency: revenueUnit, written: 0, pending: 0, mismatches: [] };

  for (const metric of Object.keys(METRICS) as Metric[]) {
    const spec = METRICS[metric];
    const series = input(metric);
    if (series.length === 0) continue;
    const annual = mode === "annual";
    const values: PeriodValue[] = spec.kind === "instant" ? instantSeries(series) : annual ? annualSeries(series) : quarterlySeries(series, { additive: spec.additive !== false });
    if (values.length === 0) continue;
    const unit = spec.unit === "shares" ? "shares" : revenueUnit;
    const def = seriesDef(symbol, metric, unit, annual && spec.kind !== "instant");
    await upsertSeries(db, [def]);

    // 四季合计与年报不一致的财年：其季度值不进入正式数据，列入待确认
    const held = new Set<string>();
    const issues = new Map<string, string>();
    if (!annual && spec.kind === "duration" && spec.additive !== false) {
      const fy = annualSeries(series);
      for (const bad of consistentMismatches(series)) {
        const start = fy.find((f) => f.end === bad.end)!.start!;
        const message = `${bad.end} 财年四季合计 ${bad.sum.toLocaleString("en-US")} 与年报 ${bad.annual.toLocaleString("en-US")} 不一致`;
        for (const q of values.filter((v) => v.end > start && v.end <= bad.end)) {
          held.add(q.end);
          issues.set(q.end, message);
        }
        result.mismatches.push(`${metric} ${bad.end}`);
      }
    }

    const fetchedAt = new Date();
    const toObs = (v: PeriodValue) => ({ obsDate: v.end, value: v.value, unit, sourceRef: filingUrl(cik, v.accn), fetchedAt });
    const w = await writeObservations(db, def, values.filter((v) => !held.has(v.end)).map(toObs));
    result.written += w.inserted + w.revised;
    for (const v of values.filter((x) => held.has(x.end))) {
      const row = { seriesId: def.id, obsDate: v.end, value: v.value, unit, sourceRef: filingUrl(cik, v.accn), fetchedAt, issues: [{ code: "four_quarter_mismatch", message: issues.get(v.end)! }] };
      await db.insert(pendingObservations).values(row).onConflictDoUpdate({ target: [pendingObservations.seriesId, pendingObservations.obsDate], set: row });
      result.pending++;
    }

    // 重述：保留较早申报的数值（只记录一次）
    for (const v of values.filter((x) => x.restatedFrom && !held.has(x.end))) {
      const exists = await db
        .select({ id: observationRevisions.id })
        .from(observationRevisions)
        .where(and(eq(observationRevisions.seriesId, def.id), eq(observationRevisions.obsDate, v.end), eq(observationRevisions.previousValue, v.restatedFrom!.value)))
        .limit(1);
      if (!exists.length) await db.insert(observationRevisions).values({ seriesId: def.id, obsDate: v.end, previousValue: v.restatedFrom!.value, previousFetchedAt: fetchedAt });
    }
  }
  return result;
}

const factAccessions = (cf: CompanyFacts) => {
  const set = new Set<string>();
  for (const t of Object.values(cf.facts)) for (const c of Object.values(t)) for (const list of Object.values(c.units)) for (const f of list) set.add(f.accn);
  return set;
};

// 检查新申报；只有出现尚未处理的定期报告时才拉取完整财务数据。
// 财务数据接口通常比申报列表晚几分钟更新，申报编号尚未出现在财务数据中时不标记为已处理，下一轮重试。
export async function runEdgar(db: Db, userAgent: string, jobId = "edgar") {
  const [run] = await db.insert(ingestRuns).values({ job: jobId, status: "running" }).returning({ id: ingestRuns.id });
  const errors: string[] = [];
  const notes: string[] = [];
  let written = 0;
  const signal = AbortSignal.timeout(10 * 60_000);
  for (const m of await activeMembers(db)) {
    try {
      const periodic = (await fetchFilings(m.cik, userAgent, signal)).filter((f) => PERIODIC_FORMS.has(f.form));
      const known = new Set(
        periodic.length ? (await db.select({ a: filings.accessionNo }).from(filings).where(inArray(filings.accessionNo, periodic.map((p) => p.accessionNumber)))).map((r) => r.a) : [],
      );
      const fresh = periodic.filter((p) => !known.has(p.accessionNumber));
      if (fresh.length === 0) continue;
      const cf = await fetchCompanyFacts(m.cik, userAgent, signal);
      const r = await ingestCompanyFacts(db, m.symbol, m.cik, cf);
      written += r.written;
      if (r.mismatches.length) notes.push(`${m.symbol} 四季合计不一致，已列入待确认：${r.mismatches.join("、")}`);
      const inFacts = factAccessions(cf);
      // 超过 30 天仍未出现在财务数据中的申报（例如 XBRL 之前的旧年报）不再等待
      const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      const processed = fresh.filter((p) => inFacts.has(p.accessionNumber) || p.filingDate < cutoff);
      if (processed.length) {
        await db
          .insert(filings)
          .values(processed.map((p) => ({ accessionNo: p.accessionNumber, cik: m.cik, form: p.form, periodEnd: p.reportDate || null, filedAt: p.filingDate, url: filingUrl(m.cik, p.accessionNumber) })))
          .onConflictDoNothing();
      }
      const waiting = fresh.length - processed.length;
      if (waiting) notes.push(`${m.symbol}：${waiting} 份新申报的财务数据尚未更新，下一轮重试`);
    } catch (error) {
      errors.push(`${m.symbol}：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await db
    .update(ingestRuns)
    .set({ status: errors.length ? "failed" : "success", finishedAt: new Date(), rowsWritten: written, error: [...errors, ...notes].join("\n") || null })
    .where(eq(ingestRuns.id, run!.id));
  return { written, errors, notes };
}
