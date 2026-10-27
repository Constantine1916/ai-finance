import type { Db } from "@/db/types";
import type { Trigger } from "@/pipeline/schedule";
import type { ReleaseRule } from "./release";

// 采集任务的类型定义；具体任务登记在 src/jobs/registry.ts
export interface ScheduledJob {
  id: string;
  trigger?: Trigger; // 定时触发
  release?: ReleaseRule; // 发布日追加采集
  run(db: Db, now: Date): Promise<void>;
}
