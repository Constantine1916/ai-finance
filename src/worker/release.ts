import { and, eq, gte, inArray, lte, max } from "drizzle-orm";
import type { Db } from "@/db/types";
import { events, observations } from "@/db/schema";
import { releasePoll, type ReleasePollDecision } from "@/pipeline/schedule";

export interface ReleaseRule {
  eventKinds: string[]; // 例如 ["cpi"]
  intervalMinutes: number;
  maxWaitMinutes: number;
}

// 某次发布是否已到达：事件关联的任一序列在发布时刻之后有新观测写入
export async function releaseArrived(db: Db, seriesIds: string[], scheduledAt: Date) {
  if (seriesIds.length === 0) return false;
  const [row] = await db
    .select({ latest: max(observations.fetchedAt) })
    .from(observations)
    .where(inArray(observations.seriesId, seriesIds));
  return Boolean(row?.latest && row.latest >= scheduledAt);
}

// 返回需要现在轮询的事件；到达或超时的事件更新状态（released / delayed）
export async function releaseEventsToPoll(db: Db, rule: ReleaseRule, now: Date, lastPoll: Date | undefined) {
  const windowStart = new Date(now.getTime() - rule.maxWaitMinutes * 60_000 - 24 * 3600_000);
  const candidates = await db
    .select()
    .from(events)
    .where(and(inArray(events.kind, rule.eventKinds), eq(events.status, "scheduled"), gte(events.scheduledAt, windowStart), lte(events.scheduledAt, now)));

  const due: typeof candidates = [];
  for (const event of candidates) {
    const arrived = await releaseArrived(db, event.seriesIds, event.scheduledAt);
    const decision: ReleasePollDecision = releasePoll(
      { scheduledAt: event.scheduledAt, intervalMinutes: rule.intervalMinutes, maxWaitMinutes: rule.maxWaitMinutes },
      now,
      lastPoll,
      arrived,
    );
    if (decision === "done") await db.update(events).set({ status: "released" }).where(eq(events.id, event.id));
    else if (decision === "give_up") await db.update(events).set({ status: "delayed" }).where(eq(events.id, event.id));
    else if (decision === "poll") due.push(event);
  }
  return due;
}
