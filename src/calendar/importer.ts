import { and, eq, gt, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/types";
import { events } from "@/db/schema";
import { easternToUtc } from "@/pipeline/calendar";
import type { OfficialEvent } from "@/sources/schedule";

// 写入官方日程：按 key 去重更新；同一类别中以后的、本次导入里已不存在的官方事件视为改期，予以删除。人工事件不受影响
export async function upsertOfficialEvents(db: Db, kinds: string[], incoming: OfficialEvent[], now = new Date()) {
  for (const e of incoming) {
    const row = { key: e.key, origin: "official", kind: e.kind, title: e.title, scheduledAt: e.scheduledAt, sourceUrl: e.sourceUrl, confirmed: true, seriesIds: e.seriesIds, note: e.note ?? null };
    await db.insert(events).values(row).onConflictDoUpdate({ target: events.key, set: { title: row.title, scheduledAt: row.scheduledAt, sourceUrl: row.sourceUrl, seriesIds: row.seriesIds, note: row.note } });
  }
  const keep = incoming.map((e) => e.key);
  const removed = await db
    .delete(events)
    .where(and(eq(events.origin, "official"), inArray(events.kind, kinds), gt(events.scheduledAt, now), keep.length ? notInArray(events.key, keep) : undefined))
    .returning({ key: events.key });
  return { upserted: incoming.length, removed: removed.map((r) => r.key) };
}

export const earningsSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z.\-]{0,9}$/, "代码格式不正确"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须是 YYYY-MM-DD"),
  timing: z.enum(["bmo", "amc", "time"], { error: "请选择发布时间" }),
  time: z.string().optional(),
  sourceUrl: z
    .string()
    .trim()
    .min(1, "必须填写来源链接")
    .refine((v) => /^https?:\/\/\S+$/.test(v), "来源链接必须以 http:// 或 https:// 开头"),
  confirmed: z.boolean(),
});

export class EventError extends Error {}

const TIMING_LABEL = { bmo: "盘前", amc: "盘后", time: "" } as const;

// 人工录入财报日期：来源必填；盘前按美东 07:00、盘后按 16:05 记录，便于排序
export async function saveEarnings(db: Db, raw: z.input<typeof earningsSchema>) {
  const parsed = earningsSchema.safeParse(raw);
  if (!parsed.success) throw new EventError(parsed.error.issues.map((i) => i.message).join("；"));
  const e = parsed.data;
  const time = e.timing === "bmo" ? "07:00" : e.timing === "amc" ? "16:05" : e.time;
  if (!time || !/^\d{2}:\d{2}$/.test(time)) throw new EventError("请填写美东时间（HH:MM）");
  const key = `earnings:${e.symbol}:${e.date}`;
  const row = {
    key,
    origin: "manual",
    kind: "earnings",
    title: `${e.symbol} 财报${TIMING_LABEL[e.timing] ? `（${TIMING_LABEL[e.timing]}）` : ""}`,
    scheduledAt: easternToUtc(e.date, time),
    sourceUrl: e.sourceUrl,
    confirmed: e.confirmed,
    seriesIds: [] as string[],
    note: e.confirmed ? null : "公司尚未确认，日期为人工估计",
  };
  await db.insert(events).values(row).onConflictDoUpdate({ target: events.key, set: row });
  return key;
}

export async function deleteManualEvent(db: Db, key: string) {
  const deleted = await db.delete(events).where(and(eq(events.key, key), eq(events.origin, "manual"))).returning({ key: events.key });
  return deleted.length > 0;
}
