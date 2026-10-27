import type { Adapter } from "@/pipeline/ingest";
import { requestJson } from "./http";

// BLS 公共 API v1（无需密钥，每日次数有限）：一次请求取全部登记序列最近两年的数据
const URL = "https://api.bls.gov/publicAPI/v1/timeseries/data/";

interface BlsResponse {
  status: string;
  message?: string[];
  Results?: { series: { seriesID: string; data: { year: string; period: string; value: string }[] }[] };
}

export function blsAdapter(seriesIds: string[], now: () => Date = () => new Date()): Adapter {
  let pending: Promise<Map<string, { obsDate: string; value: number }[]>> | undefined;
  const load = (signal: AbortSignal) => {
    pending ??= (async () => {
      const year = now().getUTCFullYear();
      const body = await requestJson<BlsResponse>("BLS", URL, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesid: seriesIds, startyear: String(year - 1), endyear: String(year) }),
      });
      if (body.status !== "REQUEST_SUCCEEDED" || !body.Results) throw new Error(`BLS 请求失败：${(body.message ?? []).join("；").slice(0, 200)}`);
      return new Map(
        body.Results.series.map((s) => [
          s.seriesID,
          s.data
            .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period) && d.value !== "-") // M13 为年均值，跳过
            .map((d) => ({ obsDate: `${d.year}-${d.period.slice(1)}-01`, value: Number(d.value) })),
        ]),
      );
    })();
    return pending;
  };
  return {
    id: "bls",
    async fetchSeries(def, { signal }) {
      const data = (await load(signal)).get(def.sourceKey);
      if (!data) throw new Error(`BLS 未返回序列 ${def.sourceKey}`);
      const fetchedAt = new Date();
      const sourceRef = `https://data.bls.gov/timeseries/${def.sourceKey}`;
      return data.map((d) => ({ ...d, unit: def.unit, sourceRef, fetchedAt }));
    },
  };
}
