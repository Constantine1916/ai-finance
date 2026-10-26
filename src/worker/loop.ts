import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { ingestRuns } from "@/db/schema";
import { isDue } from "@/pipeline/schedule";
import type { ScheduledJob } from "./jobs";
import { releaseEventsToPoll } from "./release";

async function lastRun(db: Db, jobId: string) {
  const [row] = await db.select({ startedAt: ingestRuns.startedAt }).from(ingestRuns).where(eq(ingestRuns.job, jobId)).orderBy(desc(ingestRuns.startedAt)).limit(1);
  return row?.startedAt;
}

const running = new Set<string>();

// 每分钟调用一次：运行到期的定时任务与需要轮询的发布日任务；同一任务不并发
export async function tick(db: Db, jobs: ScheduledJob[], now = new Date()) {
  const started: string[] = [];
  for (const job of jobs) {
    if (running.has(job.id)) continue;
    const previous = await lastRun(db, job.id);
    let due = job.trigger ? isDue(job.trigger, now, previous) : false;
    if (!due && job.release) due = (await releaseEventsToPoll(db, job.release, now, previous)).length > 0;
    if (!due) continue;
    running.add(job.id);
    started.push(job.id);
    try {
      await job.run(db, now);
    } catch (error) {
      console.error(`任务 ${job.id} 异常`, error instanceof Error ? error.message : error);
    } finally {
      running.delete(job.id);
    }
  }
  return started;
}
