import type { Snapshot } from "@/pipeline/intraday";
import { requestJson } from "./http";

// Finnhub 盘中报价（免费档每分钟 60 次）。只用于股票与 ETF；指数报价需要付费订阅。
export const FINNHUB_LIMIT_PER_MINUTE = 60;

interface Quote {
  c: number; // 最新价
  t: number; // 供应商时间戳（秒）
}

export async function fetchQuotes(symbols: string[], credential: string, signal: AbortSignal): Promise<{ snapshots: Snapshot[]; errors: string[] }> {
  const snapshots: Snapshot[] = [];
  const errors: string[] = [];
  for (const symbol of symbols) {
    try {
      const q = await requestJson<Quote>("Finnhub", `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`, { signal, headers: { "X-Finnhub-Token": credential } });
      // 无覆盖的代码返回 c=0，不记为价格 0
      if (!q.c) errors.push(`${symbol}：无报价`);
      else snapshots.push({ symbol, price: q.c, capturedAt: new Date(), providerTs: q.t ? new Date(q.t * 1000) : null });
    } catch (error) {
      errors.push(`${symbol}：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { snapshots, errors };
}
