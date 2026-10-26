import { sql } from "drizzle-orm";
import { getConfig } from "@/lib/config";
import { closeDb, getDb } from "@/db/client";
import { workerHeartbeat } from "@/db/schema";
import { jobs } from "./jobs";
import { tick } from "./loop";

// 采集调度器：每分钟写心跳并运行到期任务。系统 cron 通过心跳判断 worker 是否存活。
const TICK_MS = 60_000;

async function beat() {
  await getDb()
    .insert(workerHeartbeat)
    .values({ id: "worker", beatAt: new Date() })
    .onConflictDoUpdate({ target: workerHeartbeat.id, set: { beatAt: sql`now()` } });
}

async function cycle() {
  try {
    await beat();
    const started = await tick(getDb(), jobs);
    if (started.length) console.log(`${new Date().toISOString()} 运行任务：${started.join("、")}`);
  } catch (error) {
    console.error("调度周期失败", error instanceof Error ? error.message : error);
  }
}

getConfig();
await cycle();
const timer = setInterval(() => void cycle(), TICK_MS);

const shutdown = async () => {
  clearInterval(timer);
  await closeDb();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
console.log(`worker 已启动，登记任务 ${jobs.length} 个`);
