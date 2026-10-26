import type { Db } from "@/db/types";
import type { Trigger } from "@/pipeline/schedule";
import type { ReleaseRule } from "./release";

// 采集任务登记表。各数据源的任务在 1A 第 4 组加入。
export interface ScheduledJob {
  id: string;
  trigger?: Trigger; // 定时触发
  release?: ReleaseRule; // 发布日追加采集
  run(db: Db, now: Date): Promise<void>;
}

export const jobs: ScheduledJob[] = [];
