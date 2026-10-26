import { and, desc, eq, lt } from "drizzle-orm";
import type { Db } from "@/db/types";
import { intradaySnapshots, observations } from "@/db/schema";
import { easternDate, isMarketOpen } from "./calendar";

export interface Snapshot {
  symbol: string;
  price: number;
  capturedAt: Date;
  providerTs: Date | null;
}

// 盘中快照只写入快照表，不进入日线 observations
export async function storeSnapshots(db: Db, snapshots: Snapshot[]) {
  if (snapshots.length === 0) return 0;
  await db.insert(intradaySnapshots).values(snapshots).onConflictDoNothing();
  return snapshots.length;
}

export async function pruneSnapshots(db: Db, olderThan: Date) {
  await db.delete(intradaySnapshots).where(lt(intradaySnapshots.capturedAt, olderThan));
}

export type PriceView =
  | { kind: "provisional"; price: number; capturedAt: Date; providerTs: Date | null; officialDate: string | null }
  | { kind: "official"; price: number; obsDate: string }
  | { kind: "none" };

// 交易时段内且有当天快照时显示盘中暂定价；否则显示最近的正式收盘价
export async function latestPrice(db: Db, symbol: string, closeSeriesId: string, now = new Date()): Promise<PriceView> {
  const [close] = await db
    .select({ obsDate: observations.obsDate, value: observations.value })
    .from(observations)
    .where(eq(observations.seriesId, closeSeriesId))
    .orderBy(desc(observations.obsDate))
    .limit(1);

  if (isMarketOpen(now)) {
    const [snap] = await db
      .select()
      .from(intradaySnapshots)
      .where(and(eq(intradaySnapshots.symbol, symbol)))
      .orderBy(desc(intradaySnapshots.capturedAt))
      .limit(1);
    if (snap && easternDate(snap.capturedAt) === easternDate(now)) {
      return { kind: "provisional", price: snap.price, capturedAt: snap.capturedAt, providerTs: snap.providerTs, officialDate: close?.obsDate ?? null };
    }
  }
  return close ? { kind: "official", price: close.value, obsDate: close.obsDate } : { kind: "none" };
}
