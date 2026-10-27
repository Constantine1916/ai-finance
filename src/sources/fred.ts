import type { Adapter } from "@/pipeline/ingest";
import { requestJson } from "./http";

// FRED 官方 API。首次采集取全部历史；之后只取最近 120 天，用于覆盖修订。
const BASE = "https://api.stlouisfed.org/fred/series/observations";
const REVISION_WINDOW_DAYS = 120;

interface FredResponse {
  observations: { date: string; value: string }[];
}

export function fredAdapter(options: { lastObsDate?: (seriesId: string) => Promise<string | undefined> } = {}): Adapter {
  return {
    id: "fred",
    async fetchSeries(def, { credential, signal }) {
      const last = await options.lastObsDate?.(def.id);
      const params = new URLSearchParams({ series_id: def.sourceKey, api_key: credential, file_type: "json" });
      if (last) {
        const start = new Date(Date.parse(last) - REVISION_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
        params.set("observation_start", start);
      }
      const body = await requestJson<FredResponse>("FRED", `${BASE}?${params}`, { signal });
      const fetchedAt = new Date();
      const sourceRef = `https://fred.stlouisfed.org/series/${def.sourceKey}`;
      // FRED 用 "." 表示当天无数据（例如节假日），跳过而不是记为 0
      return body.observations
        .filter((o) => o.value !== "." && o.value.trim() !== "")
        .map((o) => ({ obsDate: o.date, value: Number(o.value), unit: def.unit, sourceRef, fetchedAt }));
    },
  };
}
