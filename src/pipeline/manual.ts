import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/types";
import { manualEntries, series } from "@/db/schema";
import { writeObservations } from "./store";
import type { Frequency, SeriesDef } from "./types";

// 人工录入：来源链接、数据日期、单位必填；修改保留历史版本；写入后与采集数据走同一套校验与修订
export const manualEntrySchema = z.object({
  seriesId: z.string().min(1, "请选择序列"),
  obsDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "数据日期格式必须是 YYYY-MM-DD"),
  value: z.coerce.number({ error: "数值无效" }).refine(Number.isFinite, "数值无效"),
  unit: z.string().trim().min(1, "必须填写单位"),
  sourceUrl: z
    .string()
    .trim()
    .min(1, "必须填写来源链接")
    .refine((v) => /^https?:\/\/\S+$/.test(v), "来源链接必须以 http:// 或 https:// 开头"),
  note: z.string().trim().max(500).optional(),
});

export type ManualEntryInput = z.input<typeof manualEntrySchema>;

export class ManualEntryError extends Error {}

export async function saveManualEntry(db: Db, raw: ManualEntryInput, now = new Date()) {
  const parsed = manualEntrySchema.safeParse(raw);
  if (!parsed.success) throw new ManualEntryError(parsed.error.issues.map((i) => i.message).join("；"));
  const input = parsed.data;

  const [def] = await db.select().from(series).where(eq(series.id, input.seriesId));
  if (!def || def.source !== "manual") throw new ManualEntryError("该序列不接受人工录入");
  if (def.unit !== input.unit) throw new ManualEntryError(`单位必须是 ${def.unit}`);

  const [current] = await db
    .select()
    .from(manualEntries)
    .where(and(eq(manualEntries.seriesId, input.seriesId), eq(manualEntries.obsDate, input.obsDate), eq(manualEntries.isCurrent, true)));
  if (current) await db.update(manualEntries).set({ isCurrent: false }).where(eq(manualEntries.id, current.id));
  const [entry] = await db
    .insert(manualEntries)
    .values({ ...input, note: input.note || null, version: (current?.version ?? 0) + 1, isCurrent: true, enteredAt: now })
    .returning();

  const seriesDef: SeriesDef = {
    id: def.id,
    source: def.source,
    sourceKey: def.sourceKey,
    nameZh: def.nameZh,
    unit: def.unit,
    frequency: def.frequency as Frequency,
    category: def.category,
    validMin: def.validMin ?? undefined,
    validMax: def.validMax ?? undefined,
    jumpSigma: def.jumpSigma ?? undefined,
  };
  const write = await writeObservations(db, seriesDef, [
    { obsDate: input.obsDate, value: input.value, unit: input.unit, sourceRef: input.sourceUrl, fetchedAt: now },
  ]);
  return { entry: entry!, write };
}

export async function manualHistory(db: Db, seriesId: string, obsDate: string) {
  return db
    .select()
    .from(manualEntries)
    .where(and(eq(manualEntries.seriesId, seriesId), eq(manualEntries.obsDate, obsDate)))
    .orderBy(desc(manualEntries.version));
}
