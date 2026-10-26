import { sql } from "drizzle-orm";
import { getConfig } from "@/lib/config";
import { closeDb, getDb } from "@/db/client";
import { workerHeartbeat } from "@/db/schema";

// 采集调度器入口。1A 后续任务在此注册采集任务；当前只写心跳，供 cron 检查存活。
const HEARTBEAT_MS = 60_000;

async function beat() {
  await getDb()
    .insert(workerHeartbeat)
    .values({ id: "worker", beatAt: new Date() })
    .onConflictDoUpdate({ target: workerHeartbeat.id, set: { beatAt: sql`now()` } });
}

getConfig();
await beat();
const timer = setInterval(() => void beat().catch((e) => console.error("心跳写入失败", e)), HEARTBEAT_MS);

const shutdown = async () => {
  clearInterval(timer);
  await closeDb();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
console.log("worker 已启动");
