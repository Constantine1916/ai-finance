import { and, asc, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/types";
import { observationRevisions, observations, pendingObservations, series } from "@/db/schema";
import type { ObservationInput, SeriesDef, StoredPoint } from "./types";
import { validateObservation, type ValidationResult } from "./validate";

// 缺少任一追溯字段的观测不能写入
const traceable = z.object({
  obsDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "数据日期格式必须是 YYYY-MM-DD"),
  value: z.number(),
  unit: z.string().min(1, "缺少单位"),
  sourceRef: z.string().min(1, "缺少来源链接或申报编号"),
  fetchedAt: z.date({ error: "缺少抓取时间" }),
});

export class TraceabilityError extends Error {}

export interface WriteResult {
  inserted: number;
  unchanged: number;
  revised: number;
  pending: number;
  autoAccepted: number;
}

export async function upsertSeries(db: Db, defs: SeriesDef[]) {
  for (const d of defs) {
    const row = {
      id: d.id,
      source: d.source,
      sourceKey: d.sourceKey,
      nameZh: d.nameZh,
      unit: d.unit,
      frequency: d.frequency,
      category: d.category,
      seasonalAdjustment: d.seasonalAdjustment ?? null,
      copyrightHolder: d.copyrightHolder ?? null,
      validMin: d.validMin ?? null,
      validMax: d.validMax ?? null,
      jumpSigma: d.jumpSigma ?? null,
      releaseLagDays: d.releaseLagDays ?? null,
      timelinessTargetMinutes: d.timelinessTargetMinutes ?? null,
      calendar: d.calendar ?? null,
    };
    await db.insert(series).values(row).onConflictDoUpdate({ target: series.id, set: row });
  }
}

const sameValue = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

async function acceptedHistory(db: Db, seriesId: string, before: string): Promise<StoredPoint[]> {
  const rows = await db
    .select({ obsDate: observations.obsDate, value: observations.value })
    .from(observations)
    .where(and(eq(observations.seriesId, seriesId), lt(observations.obsDate, before)))
    .orderBy(desc(observations.obsDate))
    .limit(61);
  return rows.reverse();
}

// 把通过检查的值写入正式表：新值插入，相同值不动，不同值记录修订
async function accept(db: Db, seriesId: string, obs: ObservationInput): Promise<"inserted" | "unchanged" | "revised"> {
  const [existing] = await db
    .select()
    .from(observations)
    .where(and(eq(observations.seriesId, seriesId), eq(observations.obsDate, obs.obsDate)));
  await db.delete(pendingObservations).where(and(eq(pendingObservations.seriesId, seriesId), eq(pendingObservations.obsDate, obs.obsDate)));
  if (!existing) {
    await db.insert(observations).values({ seriesId, obsDate: obs.obsDate, value: obs.value, sourceRef: obs.sourceRef, fetchedAt: obs.fetchedAt });
    return "inserted";
  }
  if (sameValue(existing.value, obs.value)) return "unchanged";
  await db.insert(observationRevisions).values({
    seriesId,
    obsDate: obs.obsDate,
    previousValue: existing.value,
    previousFetchedAt: existing.fetchedAt,
  });
  await db
    .update(observations)
    .set({ value: obs.value, sourceRef: obs.sourceRef, fetchedAt: obs.fetchedAt })
    .where(and(eq(observations.seriesId, seriesId), eq(observations.obsDate, obs.obsDate)));
  return "revised";
}

export async function writeObservations(db: Db, def: SeriesDef, inputs: ObservationInput[]): Promise<WriteResult> {
  for (const input of inputs) {
    const check = traceable.safeParse(input);
    if (!check.success) throw new TraceabilityError(`${def.id}：${check.error.issues.map((i) => i.message).join("；")}`);
  }
  const result: WriteResult = { inserted: 0, unchanged: 0, revised: 0, pending: 0, autoAccepted: 0 };
  const sorted = [...inputs].sort((a, b) => a.obsDate.localeCompare(b.obsDate));
  if (sorted.length === 0) return result;

  const history = await acceptedHistory(db, def.id, sorted[0]!.obsDate);
  for (const obs of sorted) {
    const verdict: ValidationResult = validateObservation(def, obs, history);
    if (verdict.ok) {
      result[await accept(db, def.id, obs)]++;
      history.push({ obsDate: obs.obsDate, value: obs.value });
      continue;
    }

    // 只因跳变而待确认的值，若之后再次采集得到相同结果，视为确认
    const [pending] = await db
      .select()
      .from(pendingObservations)
      .where(and(eq(pendingObservations.seriesId, def.id), eq(pendingObservations.obsDate, obs.obsDate)));
    const onlyJump = verdict.issues.every((i) => i.code === "abnormal_jump");
    if (pending && onlyJump && sameValue(pending.value, obs.value) && pending.fetchedAt < obs.fetchedAt) {
      result[await accept(db, def.id, obs)]++;
      result.autoAccepted++;
      history.push({ obsDate: obs.obsDate, value: obs.value });
      continue;
    }

    const row = { seriesId: def.id, obsDate: obs.obsDate, value: obs.value, unit: obs.unit, sourceRef: obs.sourceRef, fetchedAt: obs.fetchedAt, issues: verdict.issues };
    await db
      .insert(pendingObservations)
      .values(row)
      .onConflictDoUpdate({ target: [pendingObservations.seriesId, pendingObservations.obsDate], set: row });
    result.pending++;
  }
  return result;
}

// 用户在数据健康页确认待确认观测
export async function confirmPending(db: Db, seriesId: string, obsDate: string) {
  const [pending] = await db
    .select()
    .from(pendingObservations)
    .where(and(eq(pendingObservations.seriesId, seriesId), eq(pendingObservations.obsDate, obsDate)));
  if (!pending) return false;
  await accept(db, seriesId, { obsDate, value: pending.value, unit: pending.unit, sourceRef: pending.sourceRef, fetchedAt: pending.fetchedAt });
  return true;
}

export async function discardPending(db: Db, seriesId: string, obsDate: string) {
  const deleted = await db
    .delete(pendingObservations)
    .where(and(eq(pendingObservations.seriesId, seriesId), eq(pendingObservations.obsDate, obsDate)))
    .returning();
  return deleted.length > 0;
}

export async function readSeries(db: Db, seriesId: string): Promise<StoredPoint[]> {
  return db
    .select({ obsDate: observations.obsDate, value: observations.value })
    .from(observations)
    .where(eq(observations.seriesId, seriesId))
    .orderBy(asc(observations.obsDate));
}
