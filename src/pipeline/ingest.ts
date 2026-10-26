import { eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { ingestRuns } from "@/db/schema";
import type { ProviderConfig } from "@/lib/config";
import { writeObservations, type WriteResult } from "./store";
import type { ObservationInput, SeriesDef } from "./types";

// 可重试的错误：超时、5xx、429。其他错误（例如 4xx、解析失败）不重试
export class RetryableError extends Error {}

export interface Adapter {
  id: string;
  fetchSeries(def: SeriesDef, ctx: { credential: string; signal: AbortSignal }): Promise<ObservationInput[]>;
}

export interface IngestJob {
  id: string;
  adapter: Adapter;
  provider: ProviderConfig | { configured: true; credential: "" }; // 无需密钥的来源传入空凭据
  series: SeriesDef[];
}

export interface IngestOptions {
  maxAttempts?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface IngestOutcome {
  status: "success" | "failed" | "skipped";
  written: WriteResult;
  errors: string[];
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runIngestJob(db: Db, job: IngestJob, options: IngestOptions = {}): Promise<IngestOutcome> {
  const { maxAttempts = 3, timeoutMs = 15_000, sleep = defaultSleep } = options;
  const written: WriteResult = { inserted: 0, unchanged: 0, revised: 0, pending: 0, autoAccepted: 0 };

  if (!job.provider.configured) {
    await db.insert(ingestRuns).values({ job: job.id, status: "skipped", finishedAt: new Date(), error: job.provider.reason });
    return { status: "skipped", written, errors: [job.provider.reason] };
  }
  const credential = job.provider.credential;

  const [run] = await db.insert(ingestRuns).values({ job: job.id, status: "running" }).returning({ id: ingestRuns.id });
  const errors: string[] = [];

  for (const def of job.series) {
    let attempt = 0;
    for (;;) {
      attempt++;
      try {
        const observations = await job.adapter.fetchSeries(def, { credential, signal: AbortSignal.timeout(timeoutMs) });
        const r = await writeObservations(db, def, observations);
        for (const k of Object.keys(written) as (keyof WriteResult)[]) written[k] += r[k];
        break;
      } catch (error) {
        const retryable = error instanceof RetryableError || (error instanceof Error && error.name === "TimeoutError");
        if (retryable && attempt < maxAttempts) {
          await sleep(1000 * 2 ** (attempt - 1));
          continue;
        }
        // 错误信息只含序列与原因，不含请求地址（地址里可能有密钥）
        errors.push(`${def.id}：${error instanceof Error ? error.message : String(error)}（尝试 ${attempt} 次）`);
        break;
      }
    }
  }

  const status = errors.length === 0 ? "success" : "failed";
  await db
    .update(ingestRuns)
    .set({
      status,
      finishedAt: new Date(),
      rowsWritten: written.inserted + written.revised,
      error: errors.length ? errors.join("\n") : null,
    })
    .where(eq(ingestRuns.id, run!.id));
  return { status, written, errors };
}
