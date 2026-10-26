import { desc, eq, max, sql } from "drizzle-orm";
import type { Db } from "@/db/types";
import { ingestRuns, observations, pendingObservations, series, workerHeartbeat } from "@/db/schema";
import { easternDate } from "./calendar";
import { freshness } from "./freshness";
import type { Frequency } from "./types";

// 数据健康页所需的汇总查询

export async function latestRunsByJob(db: Db) {
  const rows = await db.select().from(ingestRuns).orderBy(desc(ingestRuns.startedAt)).limit(500);
  const byJob = new Map<string, { lastSuccess?: (typeof rows)[number]; lastFailure?: (typeof rows)[number]; latest: (typeof rows)[number] }>();
  for (const r of rows) {
    const entry = byJob.get(r.job) ?? { latest: r };
    if (r.status === "success" && !entry.lastSuccess) entry.lastSuccess = r;
    if (r.status === "failed" && !entry.lastFailure) entry.lastFailure = r;
    byJob.set(r.job, entry);
  }
  return [...byJob.entries()].map(([job, v]) => ({ job, ...v }));
}

export async function pendingList(db: Db) {
  return db
    .select({
      seriesId: pendingObservations.seriesId,
      nameZh: series.nameZh,
      obsDate: pendingObservations.obsDate,
      value: pendingObservations.value,
      unit: pendingObservations.unit,
      sourceRef: pendingObservations.sourceRef,
      fetchedAt: pendingObservations.fetchedAt,
      issues: pendingObservations.issues,
    })
    .from(pendingObservations)
    .innerJoin(series, eq(series.id, pendingObservations.seriesId))
    .orderBy(desc(pendingObservations.fetchedAt));
}

export async function seriesFreshness(db: Db, now = new Date()) {
  const rows = await db
    .select({
      id: series.id,
      nameZh: series.nameZh,
      source: series.source,
      frequency: series.frequency,
      releaseLagDays: series.releaseLagDays,
      lastObsDate: max(observations.obsDate),
      lastFetchedAt: max(observations.fetchedAt),
    })
    .from(series)
    .leftJoin(observations, eq(observations.seriesId, series.id))
    .where(eq(series.active, true))
    .groupBy(series.id);
  const today = easternDate(now);
  return rows.map((r) => {
    if (!r.lastObsDate) return { ...r, state: "empty" as const, expectedBy: null };
    const f = freshness(r.lastObsDate, r.frequency as Frequency, r.releaseLagDays ?? 0, today);
    return { ...r, state: f.stale ? ("stale" as const) : ("fresh" as const), expectedBy: f.expectedBy };
  });
}

export async function workerAlive(db: Db, now = new Date(), maxSilenceMs = 5 * 60_000) {
  const [row] = await db.select().from(workerHeartbeat).where(eq(workerHeartbeat.id, "worker"));
  return { lastBeat: row?.beatAt ?? null, alive: Boolean(row && now.getTime() - row.beatAt.getTime() < maxSilenceMs) };
}

export async function pendingCount(db: Db) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(pendingObservations);
  return row?.n ?? 0;
}
