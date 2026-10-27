import { and, asc, gte, lte } from "drizzle-orm";
import type { Db } from "@/db/types";
import { events } from "@/db/schema";
import { releaseArrived } from "@/worker/release";

export type EventStatus = "upcoming" | "released" | "awaiting" | "delayed" | "held";

// 事件显示状态：已过发布时间的数据事件，以关联序列是否有新观测为准
export async function eventsWithStatus(db: Db, from: Date, to: Date, now = new Date()) {
  const rows = await db.select().from(events).where(and(gte(events.scheduledAt, from), lte(events.scheduledAt, to))).orderBy(asc(events.scheduledAt));
  return Promise.all(
    rows.map(async (e) => {
      let status: EventStatus;
      if (e.scheduledAt > now) status = "upcoming";
      else if (e.status === "delayed") status = "delayed";
      else if (e.seriesIds.length === 0) status = "held";
      else status = e.status === "released" || (await releaseArrived(db, e.seriesIds, e.scheduledAt)) ? "released" : "awaiting";
      return { ...e, displayStatus: status };
    }),
  );
}

export const STATUS_TEXT: Record<EventStatus, string> = { upcoming: "待发布", released: "已发布", awaiting: "数据未到达", delayed: "延迟", held: "已过" };

// 事件对应的图表位置
export const KIND_LINK: Record<string, string> = { cpi: "/macro#inflation", pce: "/macro#inflation", nfp: "/macro#growth", claims: "/macro#growth", fomc: "/macro#rates" };
