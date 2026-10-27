import { and, count, desc, eq, inArray, max, min } from "drizzle-orm";
import type { Db } from "@/db/types";
import { derivedValues, observations, pendingObservations, series } from "@/db/schema";
import { readDerived } from "@/jobs/derive";
import { easternDate } from "@/pipeline/calendar";
import { annualized3m, sma, yoy, type Point } from "@/pipeline/derived";
import { freshness } from "@/pipeline/freshness";
import { readSeries } from "@/pipeline/store";
import type { Frequency } from "@/pipeline/types";
import { INDEXED_CHARTS, type ChartSpec, type LineSpec, type Range, type Transform } from "./charts";

const YEARS: Record<Range, number | null> = { "1y": 1, "3y": 3, "5y": 5, "10y": 10, max: null };
const MAX_POINTS = 900;

export interface SourceMeta {
  id: string;
  nameZh: string;
  source: string;
  copyrightHolder: string | null;
  firstObsDate: string | null;
  lastObsDate: string | null;
  lastFetchedAt: string | null;
  sourceRef: string | null;
  state: "fresh" | "stale" | "empty";
  expectedBy: string | null;
  pending: number;
}

export interface ChartData {
  id: string;
  range: Range;
  lines: { label: string; points: [string, number | null][] }[];
  sources: SourceMeta[];
  rangeStart: string | null;
  historyLimited: { label: string; firstObsDate: string }[]; // 来源历史短于所选区间
  downsampled: "week" | "month" | null;
  events: string[]; // 例如“当前倒挂始于 …”
}

function transform(points: Point[], t: Transform | undefined): Point[] {
  switch (t) {
    case "yoy":
      return yoy(points);
    case "ann3m":
      return annualized3m(points);
    case "ma4":
      return sma(points, 4);
    case "avg3diff": {
      const diff = points.map((p, i) => ({ date: p.date, value: i === 0 || p.value === null || points[i - 1]!.value === null ? null : p.value - points[i - 1]!.value! }));
      return sma(diff, 3);
    }
    default:
      return points;
  }
}

const toPoints = (rows: { obsDate: string; value: number }[]): Point[] => rows.map((r) => ({ date: r.obsDate, value: r.value }));

async function linePoints(db: Db, line: LineSpec): Promise<Point[]> {
  if ("derived" in line) return readDerived(db, line.derived);
  const base = toPoints(await readSeries(db, line.series));
  if ("newer" in line) {
    const last = base.at(-1)?.date ?? "";
    return [...base, ...toPoints(await readSeries(db, line.newer)).filter((p) => p.date > last)];
  }
  return transform(base, line.transform);
}

// 派生序列的输入序列，用于显示来源与时效
export function derivedInputs(derivedId: string): string[] {
  if (derivedId === "net-liquidity") return ["fred:WALCL", "fred:WTREGEN", "fred:RRPONTSYD"];
  if (derivedId === "ratio:VIX/VIX3M") return ["fred:VIXCLS", "fred:VXVCLS"];
  const [kind, arg = ""] = derivedId.split(":");
  if (kind === "ratio") return arg.split("/").map((t) => `tiingo:${t}:close`);
  if (kind === "adj" || kind === "sma200" || kind === "dd52w") return [`tiingo:${arg}:close`];
  return [];
}

export function lineSourceIds(line: LineSpec): string[] {
  if ("derived" in line) return derivedInputs(line.derived);
  return "newer" in line ? [line.series, line.newer] : [line.series];
}

// 按周或按月取区间内最后一个值，减少长区间的数据量；只在点数过多时使用
function downsample(points: Point[], bucket: "week" | "month"): Point[] {
  const key = (d: string) => (bucket === "month" ? d.slice(0, 7) : String(Math.floor(Date.parse(d) / (7 * 86_400_000))));
  const out: Point[] = [];
  for (const p of points) {
    if (out.length && key(out[out.length - 1]!.date) === key(p.date)) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

function lastRunBelow(points: Point[], threshold: number): string | null {
  const last = points.at(-1);
  if (!last || last.value === null || last.value >= threshold) return null;
  let i = points.length - 1;
  while (i > 0 && points[i - 1]!.value !== null && points[i - 1]!.value! < threshold) i--;
  return points[i]!.date;
}

function lastCrossAbove(points: Point[], threshold: number): string | null {
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1]!.value;
    const b = points[i]!.value;
    if (a !== null && b !== null && a < threshold && b >= threshold) return points[i]!.date;
  }
  return null;
}

export async function sourceMeta(db: Db, ids: string[], now = new Date()): Promise<SourceMeta[]> {
  if (ids.length === 0) return [];
  const defs = await db.select().from(series).where(inArray(series.id, ids));
  const stats = await db
    .select({ id: observations.seriesId, first: min(observations.obsDate), last: max(observations.obsDate), fetched: max(observations.fetchedAt) })
    .from(observations)
    .where(inArray(observations.seriesId, ids))
    .groupBy(observations.seriesId);
  const pend = await db.select({ id: pendingObservations.seriesId, n: count() }).from(pendingObservations).where(inArray(pendingObservations.seriesId, ids)).groupBy(pendingObservations.seriesId);
  const today = easternDate(now);
  const out: SourceMeta[] = [];
  for (const id of ids) {
    const d = defs.find((x) => x.id === id);
    if (!d) continue;
    const s = stats.find((x) => x.id === id);
    const [latest] = s?.last
      ? await db.select({ ref: observations.sourceRef }).from(observations).where(and(eq(observations.seriesId, id), eq(observations.obsDate, s.last))).limit(1)
      : [];
    const f = s?.last ? freshness(s.last, d.frequency as Frequency, d.releaseLagDays ?? 0, today) : null;
    out.push({
      id,
      nameZh: d.nameZh,
      source: d.source,
      copyrightHolder: d.copyrightHolder,
      firstObsDate: s?.first ?? null,
      lastObsDate: s?.last ?? null,
      lastFetchedAt: s?.fetched ? s.fetched.toISOString() : null,
      sourceRef: latest?.ref ?? null,
      state: !s?.last ? "empty" : f?.stale ? "stale" : "fresh",
      expectedBy: f?.expectedBy ?? null,
      pending: pend.find((x) => x.id === id)?.n ?? 0,
    });
  }
  return out;
}

export async function buildChart(db: Db, spec: ChartSpec, range: Range, now = new Date()): Promise<ChartData> {
  const years = YEARS[range];
  const start = years === null ? null : new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);

  const full = await Promise.all(spec.lines.map((l) => linePoints(db, l)));
  const events: string[] = [];
  for (const a of spec.annotations ?? []) {
    const first = full[0] ?? [];
    if (a.kind === "shade-below") {
      const since = lastRunBelow(first, a.value);
      events.push(since ? `${a.label}：当前处于倒挂，始于 ${since}` : `${a.label}：当前未倒挂`);
    }
    if (a.kind === "threshold" && spec.id === "sahm") {
      const crossed = lastCrossAbove(first, a.value);
      if (crossed) events.push(`最近一次越过 ${a.value}：${crossed}`);
    }
  }

  let lines = full.map((points, i) => ({ label: spec.lines[i]!.label, points: start ? points.filter((p) => p.date >= start) : points }));
  const longest = Math.max(0, ...lines.map((l) => l.points.length));
  const bucket = longest > MAX_POINTS ? (years !== null && years <= 10 ? "week" : "month") : null;
  if (bucket) lines = lines.map((l) => ({ ...l, points: downsample(l.points, bucket) }));
  // 先降采样再换算，保证图上第一个点正好是 100
  if (INDEXED_CHARTS.has(spec.id)) {
    lines = lines.map((l) => {
      const base = l.points.find((p) => p.value !== null)?.value;
      return { ...l, points: l.points.map((p) => ({ date: p.date, value: p.value === null || !base ? null : (p.value / base) * 100 })) };
    });
  }

  const ids = [...new Set(spec.lines.flatMap(lineSourceIds))];
  const sources = await sourceMeta(db, ids, now);
  // 补充最新日期用的来源（如财政部）本来就只有近期数据，不算历史不足
  const supplements = new Set(spec.lines.flatMap((l) => ("newer" in l ? [l.newer] : [])));
  const historyLimited = start
    ? sources.filter((s) => !supplements.has(s.id) && s.firstObsDate && s.firstObsDate > start).map((s) => ({ label: s.nameZh, firstObsDate: s.firstObsDate! }))
    : [];

  return {
    id: spec.id,
    range,
    lines: lines.map((l) => ({ label: l.label, points: l.points.map((p) => [p.date, p.value === null ? null : Number(p.value.toPrecision(6))] as [string, number | null]) })),
    sources,
    rangeStart: start,
    historyLimited,
    downsampled: bucket,
    events,
  };
}

// 派生序列的最新日期，用于派生图表的时效显示
export async function derivedLastDate(db: Db, derivedId: string) {
  const [row] = await db.select({ d: derivedValues.obsDate }).from(derivedValues).where(eq(derivedValues.derivedId, derivedId)).orderBy(desc(derivedValues.obsDate)).limit(1);
  return row?.d ?? null;
}
