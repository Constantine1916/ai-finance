import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/types";
import { filings, ingestRuns, observations, pendingObservations } from "@/db/schema";
import { upsertSeries, writeObservations } from "@/pipeline/store";
import type { SeriesDef } from "@/pipeline/types";
import { documentUrl, fetchFilings } from "@/sources/edgar";
import { request } from "@/sources/http";
import { parseRevenueReport, shiftMonth, type TsmcRevenueReport } from "@/sources/tsmc";

export const TSMC_CIK = "1046179";
export const TSMC_REVENUE: SeriesDef = {
  id: "tsmc:revenue",
  source: "tsmc",
  sourceKey: "monthly-revenue",
  nameZh: "台积电月营收",
  unit: "Millions of New Taiwan Dollars",
  frequency: "monthly",
  category: "ai-supply",
  validMin: 0,
  releaseLagDays: 12,
};

const TOLERANCE = 1; // 报告中的数值四舍五入到百万新台币

// 写入一份报告：当月为主值；上月与去年同月若已存在且不一致则列入待确认，不存在则补入
export async function applyReport(db: Db, report: TsmcRevenueReport, sourceRef: string, fetchedAt = new Date()) {
  const notes: string[] = [];
  const points = [
    { month: report.month, value: report.current, label: "当月" },
    { month: shiftMonth(report.month, -1), value: report.priorMonth, label: "上月" },
    { month: shiftMonth(report.month, -12), value: report.yearAgo, label: "去年同月" },
  ];
  const stored = new Map(
    (await db.select().from(observations).where(and(eq(observations.seriesId, TSMC_REVENUE.id), inArray(observations.obsDate, points.map((p) => p.month))))).map((r) => [r.obsDate, r.value]),
  );
  for (const p of points) {
    const prior = stored.get(p.month);
    if (prior !== undefined && Math.abs(prior - p.value) > TOLERANCE) {
      const row = { seriesId: TSMC_REVENUE.id, obsDate: p.month, value: p.value, unit: TSMC_REVENUE.unit, sourceRef, fetchedAt, issues: [{ code: "cross_check_mismatch", message: `${report.month.slice(0, 7)} 报告中的${p.label}数值 ${p.value} 与已存 ${prior} 不一致` }] };
      await db.insert(pendingObservations).values(row).onConflictDoUpdate({ target: [pendingObservations.seriesId, pendingObservations.obsDate], set: row });
      notes.push(`${p.month.slice(0, 7)} 不一致`);
      continue;
    }
    if (prior === undefined) await writeObservations(db, TSMC_REVENUE, [{ obsDate: p.month, value: p.value, unit: TSMC_REVENUE.unit, sourceRef, fetchedAt }]);
  }
  // 年初累计核对：当年 1 月至当月都已存在时，逐月合计应等于报告的累计数
  const year = report.month.slice(0, 4);
  const months = Array.from({ length: Number(report.month.slice(5, 7)) }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);
  const ytdRows = await db.select().from(observations).where(and(eq(observations.seriesId, TSMC_REVENUE.id), inArray(observations.obsDate, months)));
  if (ytdRows.length === months.length) {
    const sum = ytdRows.reduce((a, r) => a + r.value, 0);
    if (Math.abs(sum - report.ytd) > TOLERANCE * months.length) notes.push(`${report.month.slice(0, 7)} 年初累计 ${report.ytd} 与逐月合计 ${sum} 不一致`);
  }
  return notes;
}

export async function runTsmc(db: Db, userAgent: string) {
  const [run] = await db.insert(ingestRuns).values({ job: "tsmc", status: "running" }).returning({ id: ingestRuns.id });
  const errors: string[] = [];
  const notes: string[] = [];
  let processed = 0;
  try {
    await upsertSeries(db, [TSMC_REVENUE]);
    const signal = AbortSignal.timeout(10 * 60_000);
    const candidates = (await fetchFilings(TSMC_CIK, userAgent, signal)).filter((f) => f.form === "6-K" && /revenue/i.test(f.primaryDocument));
    const known = new Set(candidates.length ? (await db.select({ a: filings.accessionNo }).from(filings).where(inArray(filings.accessionNo, candidates.map((c) => c.accessionNumber)))).map((r) => r.a) : []);
    // 从最早的开始处理，后面的报告可以核对前面的数值
    for (const f of candidates.filter((c) => !known.has(c.accessionNumber)).reverse()) {
      const url = documentUrl(TSMC_CIK, f.accessionNumber, f.primaryDocument);
      const html = await (await request("SEC EDGAR", url, { signal, headers: { "User-Agent": userAgent } })).text();
      await new Promise((r) => setTimeout(r, 150));
      const report = parseRevenueReport(html);
      if (!report) {
        notes.push(`${f.filingDate} ${f.primaryDocument} 未解析到营收表，已跳过`);
      } else {
        notes.push(...(await applyReport(db, report, url)));
        processed++;
      }
      await db.insert(filings).values({ accessionNo: f.accessionNumber, cik: TSMC_CIK, form: "6-K", periodEnd: report?.month ?? null, filedAt: f.filingDate, url }).onConflictDoNothing();
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  await db
    .update(ingestRuns)
    .set({ status: errors.length ? "failed" : "success", finishedAt: new Date(), rowsWritten: processed, error: [...errors, ...notes].join("\n") || null })
    .where(eq(ingestRuns.id, run!.id));
  return { processed, errors, notes };
}
