import { and, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "@/db/types";
import { observations, pendingObservations } from "@/db/schema";
import { TREASURY_TENORS } from "@/sources/catalog";

const TOLERANCE = 0.005; // 收益率差 0.5 个基点以内视为一致（两边均四舍五入到 0.01）

// 财政部与 FRED 同一日期的收益率不一致时，把财政部的值移入待确认
export async function crossCheckTreasury(db: Db, since: string) {
  const mismatches: { seriesId: string; obsDate: string; treasury: number; fred: number }[] = [];
  for (const t of TREASURY_TENORS) {
    const treasuryId = `treasury:${t.key}`;
    const rows = await db
      .select()
      .from(observations)
      .where(and(inArray(observations.seriesId, [treasuryId, t.fred]), gte(observations.obsDate, since)));
    const fred = new Map(rows.filter((r) => r.seriesId === t.fred).map((r) => [r.obsDate, r.value]));
    for (const r of rows.filter((x) => x.seriesId === treasuryId)) {
      const f = fred.get(r.obsDate);
      if (f === undefined || Math.abs(f - r.value) <= TOLERANCE) continue;
      mismatches.push({ seriesId: treasuryId, obsDate: r.obsDate, treasury: r.value, fred: f });
      await db.transaction(async (tx) => {
        await tx
          .insert(pendingObservations)
          .values({ seriesId: treasuryId, obsDate: r.obsDate, value: r.value, unit: "Percent", sourceRef: r.sourceRef, fetchedAt: r.fetchedAt, issues: [{ code: "cross_check_mismatch", message: `与 FRED ${t.fred.slice(5)} 的 ${f} 不一致` }] })
          .onConflictDoNothing();
        await tx.delete(observations).where(and(eq(observations.seriesId, treasuryId), eq(observations.obsDate, r.obsDate)));
      });
    }
  }
  return mismatches;
}
