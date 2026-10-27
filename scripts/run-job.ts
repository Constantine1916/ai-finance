import { closeDb, getDb } from "@/db/client";
import { JOBS, registerSeries } from "@/jobs/registry";

// 手动运行采集任务（用于首次回填与排查）：npm run job -- fred tiingo
const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.log(`可用任务：${JOBS.map((j) => j.id).join("、")}`);
  process.exit(0);
}
const db = getDb();
await registerSeries(db);
for (const id of ids) {
  const job = JOBS.find((j) => j.id === id);
  if (!job) {
    console.error(`未知任务 ${id}`);
    process.exitCode = 1;
    continue;
  }
  const started = Date.now();
  await job.run(db, new Date());
  console.log(`${id} 用时 ${((Date.now() - started) / 1000).toFixed(1)} 秒`);
}
await closeDb();
