import type { Adapter } from "@/pipeline/ingest";
import { requestJson } from "./http";

// BEA NIPA 月度表，按序列代码取值
interface BeaResponse {
  BEAAPI: { Error?: { APIErrorDescription?: string }; Results?: { Error?: { APIErrorDescription?: string }; Data?: { SeriesCode: string; TimePeriod: string; DataValue: string }[] } };
}

export function beaAdapter(now: () => Date = () => new Date()): Adapter {
  const cache = new Map<string, Promise<BeaResponse>>();
  return {
    id: "bea",
    async fetchSeries(def, { credential, signal }) {
      const [table, code] = def.sourceKey.split(":") as [string, string];
      const year = now().getUTCFullYear();
      if (!cache.has(table)) {
        const params = new URLSearchParams({ UserID: credential, method: "GetData", datasetname: "NIPA", TableName: table, Frequency: "M", Year: `${year - 1},${year}`, ResultFormat: "JSON" });
        cache.set(table, requestJson<BeaResponse>("BEA", `https://apps.bea.gov/api/data/?${params}`, { signal }));
      }
      const body = (await cache.get(table)!).BEAAPI;
      const error = body.Error ?? body.Results?.Error;
      if (error) throw new Error(`BEA 返回错误：${error.APIErrorDescription ?? "未知"}`);
      const rows = (body.Results?.Data ?? []).filter((d) => d.SeriesCode === code);
      if (rows.length === 0) throw new Error(`BEA 表 ${table} 中没有序列 ${code}`);
      const fetchedAt = new Date();
      const sourceRef = `https://apps.bea.gov/iTable/?reqid=19&step=2&isuri=1&categories=survey#eyJhcHBpZCI6MTl9`;
      return rows.map((d) => ({ obsDate: `${d.TimePeriod.slice(0, 4)}-${d.TimePeriod.slice(5)}-01`, value: Number(d.DataValue.replace(/,/g, "")), unit: def.unit, sourceRef, fetchedAt }));
    },
  };
}
