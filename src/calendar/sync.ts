import { eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { ingestRuns } from "@/db/schema";
import { getConfig } from "@/lib/config";
import { BEA_ICS_URL, FOMC_URL, FRED_RELEASES, fetchFredReleaseDates, fetchText, fredReleaseEvents, parseBeaIcs, parseFomc, type OfficialEvent } from "@/sources/schedule";
import { upsertOfficialEvents } from "./importer";

// 同步官方日程：FOMC（美联储网页）、PCE（BEA 日历）、CPI / 非农 / 初请（FRED 收录的发布日期）
export async function syncCalendar(db: Db, now = new Date()) {
  const [run] = await db.insert(ingestRuns).values({ job: "calendar", status: "running" }).returning({ id: ingestRuns.id });
  const errors: string[] = [];
  let written = 0;
  const signal = AbortSignal.timeout(60_000);
  const step = async (name: string, kinds: string[], load: () => Promise<OfficialEvent[]>) => {
    try {
      const incoming = await load();
      if (incoming.length === 0) throw new Error("没有解析到任何事件，页面结构可能已变化");
      const r = await upsertOfficialEvents(db, kinds, incoming, now);
      written += r.upserted;
      if (r.removed.length) console.log(`${name}：移除改期事件 ${r.removed.join("、")}`);
    } catch (error) {
      // 解析失败时保留已有日程，不清空
      errors.push(`${name}：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  await step("FOMC", ["fomc"], async () => parseFomc(await fetchText("美联储", FOMC_URL, signal)));
  await step("BEA", ["pce"], async () => parseBeaIcs(await fetchText("BEA", BEA_ICS_URL, signal)));
  const fred = getConfig().providers.fred;
  if (!fred.configured) errors.push(`CPI、非农、初请：${fred.reason}`);
  else {
    const from = new Date(now.getTime() - 60 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 548 * 86_400_000).toISOString().slice(0, 10);
    for (const release of FRED_RELEASES) {
      await step(release.title, [release.kind], async () => fredReleaseEvents(release, await fetchFredReleaseDates(release.id, fred.credential, from, to, signal)));
    }
  }

  await db
    .update(ingestRuns)
    .set({ status: errors.length ? "failed" : "success", finishedAt: new Date(), rowsWritten: written, error: errors.length ? errors.join("\n") : null })
    .where(eq(ingestRuns.id, run!.id));
  return { written, errors };
}
