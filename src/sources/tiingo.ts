import type { Adapter } from "@/pipeline/ingest";
import type { ObservationInput } from "@/pipeline/types";
import { requestJson } from "./http";

// Tiingo 日线：一次请求同时得到收盘价、分红与拆股系数，三个序列共用同一次请求的结果
const BASE = "https://api.tiingo.com/tiingo/daily";
const HISTORY_START = "2000-01-01";
const REFRESH_DAYS = 14;

interface TiingoBar {
  date: string;
  close: number;
  divCash: number;
  splitFactor: number;
}

export function tiingoAdapter(options: { lastObsDate?: (seriesId: string) => Promise<string | undefined> } = {}): Adapter {
  // 按代码缓存：同一次运行中，收盘价写入后再取分红与拆股时，必须沿用第一次确定的起始日期
  const cache = new Map<string, Promise<TiingoBar[]>>();
  return {
    id: "tiingo",
    async fetchSeries(def, { credential, signal }) {
      const [ticker, field] = def.sourceKey.split(":") as [string, "close" | "div" | "split"];
      if (!cache.has(ticker)) {
        cache.set(
          ticker,
          (async () => {
            const last = await options.lastObsDate?.(`tiingo:${ticker}:close`);
            const start = last ? new Date(Date.parse(last) - REFRESH_DAYS * 86_400_000).toISOString().slice(0, 10) : HISTORY_START;
            const params = new URLSearchParams({ startDate: start });
            return requestJson<TiingoBar[]>("Tiingo", `${BASE}/${encodeURIComponent(ticker)}/prices?${params}`, { signal, headers: { Authorization: `Token ${credential}` } });
          })(),
        );
      }
      const bars = await cache.get(ticker)!;
      if (!Array.isArray(bars)) throw new Error("Tiingo 返回格式异常");
      const fetchedAt = new Date();
      const sourceRef = `https://www.tiingo.com/${ticker.toLowerCase()}/overview`;
      const out: ObservationInput[] = [];
      for (const b of bars) {
        const obsDate = b.date.slice(0, 10);
        if (field === "close") out.push({ obsDate, value: b.close, unit: def.unit, sourceRef, fetchedAt });
        else if (field === "div" && b.divCash > 0) out.push({ obsDate, value: b.divCash, unit: def.unit, sourceRef, fetchedAt });
        else if (field === "split" && b.splitFactor !== 1) out.push({ obsDate, value: b.splitFactor, unit: def.unit, sourceRef, fetchedAt });
      }
      return out;
    },
  };
}
