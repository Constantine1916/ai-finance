import type { Db } from "@/db/types";
import { getConfig } from "@/lib/config";
import { runDerive } from "@/jobs/derive";
import { ingestCompanyFacts } from "@/jobs/edgar";
import { runIngestJob } from "@/pipeline/ingest";
import { upsertSeries } from "@/pipeline/store";
import { tiingoSeries } from "@/sources/catalog";
import { fetchCompanyFacts } from "@/sources/edgar";
import { tiingoAdapter } from "@/sources/tiingo";

const running = new Set<string>();

// 新增成员后立即补齐历史日线与财报，再重算派生指标；在后台运行，不阻塞页面
export function startBackfill(db: Db, symbol: string, cik: string) {
  if (running.has(symbol)) return;
  running.add(symbol);
  void (async () => {
    try {
      const config = getConfig();
      const series = tiingoSeries(symbol);
      await upsertSeries(db, series);
      await runIngestJob(db, { id: `backfill:${symbol}:prices`, adapter: tiingoAdapter(), provider: config.providers.tiingo, series });
      if (config.providers.edgar.configured) {
        await ingestCompanyFacts(db, symbol, cik, await fetchCompanyFacts(cik, config.providers.edgar.credential, AbortSignal.timeout(120_000)));
      }
      await runDerive(db);
    } catch (error) {
      console.error(`${symbol} 补采失败`, error instanceof Error ? error.message : error);
    } finally {
      running.delete(symbol);
    }
  })();
}

export const isBackfilling = (symbol: string) => running.has(symbol);
