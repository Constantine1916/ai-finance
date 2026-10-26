import { desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ingestRuns } from "@/db/schema";
import { RetryableError, runIngestJob, type Adapter } from "@/pipeline/ingest";
import { readSeries, upsertSeries } from "@/pipeline/store";
import type { SeriesDef } from "@/pipeline/types";
import { testDb } from "./helpers";

// 以下为模拟供应商测试，不代表真实供应商验证
const { db, close } = testDb();
afterAll(close);

const def: SeriesDef = { id: "t:ingest", source: "fred", sourceKey: "X", nameZh: "测试", unit: "Percent", frequency: "daily", category: "rates" };
beforeAll(() => upsertSeries(db, [def]));
const noSleep = async () => {};
const point = (obsDate: string, value: number) => ({ obsDate, value, unit: "Percent", sourceRef: "https://example.org", fetchedAt: new Date() });

function adapter(behaviour: (call: number, credential: string) => ReturnType<Adapter["fetchSeries"]>) {
  let calls = 0;
  const a: Adapter & { calls: () => number } = {
    id: "mock",
    fetchSeries: (_def, ctx) => behaviour(++calls, ctx.credential),
    calls: () => calls,
  };
  return a;
}

const lastRun = async (job: string) => (await db.select().from(ingestRuns).where(eq(ingestRuns.job, job)).orderBy(desc(ingestRuns.id)).limit(1))[0]!;

describe("runIngestJob (simulated provider)", () => {
  it("skips without calling the provider when the key is missing", async () => {
    const a = adapter(async () => [point("2026-10-01", 1)]);
    const r = await runIngestJob(db, { id: "job:nokey", adapter: a, provider: { configured: false, reason: "未配置 FRED_API_KEY" }, series: [def] });
    expect(r.status).toBe("skipped");
    expect(a.calls()).toBe(0);
    expect((await lastRun("job:nokey")).status).toBe("skipped");
  });

  it("retries transient failures and then writes", async () => {
    const a = adapter(async (call) => {
      if (call < 3) throw new RetryableError("HTTP 503");
      return [point("2026-10-01", 1)];
    });
    const r = await runIngestJob(db, { id: "job:retry", adapter: a, provider: { configured: true, credential: "k" }, series: [def] }, { sleep: noSleep });
    expect(r.status).toBe("success");
    expect(a.calls()).toBe(3);
  });

  it("keeps existing data and records the reason when retries run out", async () => {
    const before = await readSeries(db, "t:ingest");
    const a = adapter(async () => {
      throw new RetryableError("HTTP 429");
    });
    const r = await runIngestJob(db, { id: "job:fail", adapter: a, provider: { configured: true, credential: "secret-key-value" }, series: [def] }, { sleep: noSleep });
    expect(r.status).toBe("failed");
    expect(a.calls()).toBe(3);
    expect(await readSeries(db, "t:ingest")).toEqual(before);
    const run = await lastRun("job:fail");
    expect(run.status).toBe("failed");
    expect(run.error).toContain("HTTP 429");
    expect(run.error).not.toContain("secret-key-value");
  });

  it("does not retry non-transient errors", async () => {
    const a = adapter(async () => {
      throw new Error("HTTP 400");
    });
    await runIngestJob(db, { id: "job:fatal", adapter: a, provider: { configured: true, credential: "k" }, series: [def] }, { sleep: noSleep });
    expect(a.calls()).toBe(1);
  });
});
