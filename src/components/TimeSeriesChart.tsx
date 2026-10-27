"use client";

import { useEffect, useRef, useState } from "react";
import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { ChartData } from "@/macro/build";
import { RANGE_LABEL, RANGES, type Annotation, type Range } from "@/macro/charts";

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, CanvasRenderer]);

// 分类色：按固定顺序分配，深色背景下已通过色觉缺陷与对比度校验（#121821 面板）
const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500"];
const INK = { primary: "#e6edf3", muted: "#8b98a5", grid: "#1f2a37", reference: "#5b6876" };

export interface ChartMeta {
  id: string;
  title: string;
  unit: string;
  annotations: Annotation[];
  defaultRange: Range;
}

const fmt = (v: number | null) => (v === null ? "—" : Math.abs(v) >= 1000 ? v.toLocaleString("zh-CN", { maximumFractionDigits: 0 }) : v.toLocaleString("zh-CN", { maximumFractionDigits: 2 }));

// 连续满足条件的区间，用于倒挂等阴影
function segments(points: [string, number | null][], test: (v: number) => boolean): [string, string][] {
  const out: [string, string][] = [];
  let start: string | null = null;
  let prev: string | null = null;
  for (const [d, v] of points) {
    if (v !== null && test(v)) start ??= d;
    else if (start) {
      out.push([start, prev ?? start]);
      start = null;
    }
    prev = d;
  }
  if (start && prev) out.push([start, prev]);
  return out;
}

function buildOption(meta: ChartMeta, data: ChartData): echarts.EChartsCoreOption {
  const thresholds = meta.annotations.filter((a): a is Extract<Annotation, { kind: "threshold" }> => a.kind === "threshold");
  const shades = meta.annotations.filter((a) => a.kind !== "threshold");
  const first = data.lines[0]?.points ?? [];
  return {
    animation: false,
    grid: { left: 8, right: 64, top: data.lines.length > 1 ? 36 : 16, bottom: 8, containLabel: true },
    legend: data.lines.length > 1 ? { top: 0, left: 0, textStyle: { color: INK.muted, fontSize: 12 }, itemWidth: 14, itemHeight: 2, icon: "rect" } : undefined,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: INK.reference } },
      backgroundColor: "#0b0f14",
      borderColor: INK.grid,
      textStyle: { color: INK.primary, fontSize: 12 },
      valueFormatter: (v: unknown) => `${fmt(typeof v === "number" ? v : null)} ${meta.unit}`,
    },
    xAxis: { type: "time", axisLine: { lineStyle: { color: INK.grid } }, axisLabel: { color: INK.muted, hideOverlap: true }, splitLine: { show: false } },
    yAxis: { type: "value", scale: true, axisLabel: { color: INK.muted, formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { color: INK.grid } } },
    series: data.lines.map((line, i) => ({
      name: line.label,
      type: "line",
      data: line.points,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 2, color: SERIES_COLORS[i % SERIES_COLORS.length] },
      itemStyle: { color: SERIES_COLORS[i % SERIES_COLORS.length] },
      endLabel: data.lines.length <= 4 ? { show: true, color: INK.primary, fontSize: 11, formatter: (p: { value: [string, number | null] }) => fmt(p.value[1]) } : undefined,
      labelLayout: { moveOverlap: "shiftY" },
      markLine:
        i === 0 && thresholds.length
          ? { silent: true, symbol: "none", lineStyle: { color: INK.reference, type: "dashed", width: 1 }, label: { color: INK.muted, formatter: "{b}", position: "insideStartTop" }, data: thresholds.map((t) => ({ yAxis: t.value, name: t.label })) }
          : undefined,
      markArea:
        i === 0 && shades.length
          ? {
              silent: true,
              itemStyle: { color: "rgba(217, 89, 38, 0.14)" },
              data: shades.flatMap((a) => segments(first, (v) => (a.kind === "shade-below" ? v < a.value : v > a.value)).map(([s, e]) => [{ xAxis: s }, { xAxis: e }])),
            }
          : undefined,
    })),
  };
}

export default function TimeSeriesChart({ meta }: { meta: ChartMeta }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [range, setRange] = useState<Range>(meta.defaultRange);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState(false);

  // 进入视口后才加载数据
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetch(`/api/charts/${meta.id}?range=${range}`)
      .then(async (r) => {
        if (r.status === 401) throw new Error("登录已过期，请刷新页面重新登录");
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "数据暂不可用");
        return (await r.json()) as ChartData;
      })
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [visible, range, meta.id]);

  useEffect(() => {
    // 切换到表格时图表容器被卸载，旧实例必须释放，切回时重新创建
    if (table) {
      chart.current?.dispose();
      chart.current = null;
      return;
    }
    if (!data || !container.current) return;
    chart.current ??= echarts.init(container.current, undefined, { renderer: "canvas" });
    chart.current.setOption(buildOption(meta, data), true);
    const resize = () => chart.current?.resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [data, meta, table]);

  useEffect(() => () => chart.current?.dispose(), []);

  const empty = data && data.lines.every((l) => l.points.every((p) => p[1] === null));
  const rows = data ? [...new Set(data.lines.flatMap((l) => l.points.map((p) => p[0])))].sort().slice(-24).reverse() : [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            aria-pressed={r === range}
            className={`rounded px-2 py-0.5 ${r === range ? "bg-[var(--border)] text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
        <button type="button" onClick={() => setTable((t) => !t)} className="ml-auto rounded px-2 py-0.5 text-[var(--muted)] hover:text-[var(--text)]">
          {table ? "图表" : "表格"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--down)]">{error}</p>}
      {data && (data.historyLimited.length > 0 || data.downsampled || data.events.length > 0) && (
        <ul className="mt-2 space-y-0.5 text-xs text-[var(--muted)]">
          {data.events.map((e) => (
            <li key={e} className="text-[var(--text)]">
              {e}
            </li>
          ))}
          {data.historyLimited.map((h) => (
            <li key={h.label}>
              {h.label}：来源只提供 {h.firstObsDate} 以来的数据，图中显示可得部分
            </li>
          ))}
          {data.downsampled && <li>长区间按{data.downsampled === "week" ? "周" : "月"}末取值显示</li>}
        </ul>
      )}
      {empty && <p className="mt-2 text-xs text-[var(--muted)]">所选区间暂无数据。</p>}
      {table && data ? (
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--muted)]">
                <th className="px-1 py-0.5 text-left font-normal">日期</th>
                {data.lines.map((l) => (
                  <th key={l.label} className="px-1 py-0.5 text-right font-normal">
                    {l.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d} className="border-t border-[var(--border)]">
                  <td className="num px-1 py-0.5">{d}</td>
                  {data.lines.map((l) => (
                    <td key={l.label} className="num px-1 py-0.5 text-right">
                      {fmt(l.points.find((p) => p[0] === d)?.[1] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-[var(--muted)]">显示所选区间最近 24 个数据点，单位：{meta.unit}</p>
        </div>
      ) : (
        <div ref={container} className="mt-2 h-64 w-full" role="img" aria-label={`${meta.title}，单位 ${meta.unit}`}>
          {!data && !error && <p className="pt-24 text-center text-xs text-[var(--muted)]">加载中…</p>}
        </div>
      )}
    </div>
  );
}
