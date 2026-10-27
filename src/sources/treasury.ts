import type { Adapter } from "@/pipeline/ingest";
import { request } from "./http";

// 美国财政部每日收益率曲线 CSV（按年）。当日收盘后即可取得，比 FRED 早一个工作日。
const yearUrl = (year: number) =>
  `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;

export function parseTreasuryCsv(csv: string): Map<string, Map<string, number>> {
  const lines = csv.trim().split(/\r?\n/);
  const header = (lines.shift() ?? "").split(",").map((h) => h.replace(/"/g, "").trim());
  const rows = new Map<string, Map<string, number>>();
  for (const line of lines) {
    const cells = line.split(",");
    const [m, d, y] = (cells[0] ?? "").split("/");
    if (!m || !d || !y) continue;
    const date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const values = new Map<string, number>();
    header.forEach((h, i) => {
      const v = cells[i]?.trim();
      if (i > 0 && v && v !== "N/A" && Number.isFinite(Number(v))) values.set(h, Number(v));
    });
    rows.set(date, values);
  }
  return rows;
}

export function treasuryAdapter(now: () => Date = () => new Date()): Adapter {
  const cache = new Map<number, Promise<Map<string, Map<string, number>>>>();
  const load = (year: number, signal: AbortSignal) => {
    if (!cache.has(year)) cache.set(year, request("财政部", yearUrl(year), { signal }).then(async (r) => parseTreasuryCsv(await r.text())));
    return cache.get(year)!;
  };
  return {
    id: "treasury",
    async fetchSeries(def, { signal }) {
      const year = now().getUTCFullYear();
      // 1 月初也取上一年，避免年初几天没有可比较的数据
      const years = now().getUTCMonth() === 0 ? [year - 1, year] : [year];
      const fetchedAt = new Date();
      const out = [];
      for (const y of years) {
        for (const [obsDate, values] of await load(y, signal)) {
          const value = values.get(def.sourceKey);
          if (value !== undefined) out.push({ obsDate, value, unit: def.unit, sourceRef: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates", fetchedAt });
        }
      }
      return out;
    },
  };
}
