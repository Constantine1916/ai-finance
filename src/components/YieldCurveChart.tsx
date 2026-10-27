"use client";

import { useEffect, useRef } from "react";
import { LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70"];

export interface Curve {
  label: string;
  date: string;
  values: number[];
}

// 收益率曲线：横轴为期限，不是时间
export default function YieldCurveChart({ tenors, curves }: { tenors: string[]; curves: Curve[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const chart = echarts.init(el.current);
    chart.setOption({
      animation: false,
      grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, textStyle: { color: "#8b98a5", fontSize: 12 }, icon: "rect", itemWidth: 14, itemHeight: 2, itemStyle: { borderWidth: 0 } },
      tooltip: { trigger: "axis", backgroundColor: "#0b0f14", borderColor: "#1f2a37", textStyle: { color: "#e6edf3", fontSize: 12 }, valueFormatter: (v: unknown) => `${Number(v).toFixed(2)}%` },
      xAxis: { type: "category", data: tenors, axisLine: { lineStyle: { color: "#1f2a37" } }, axisLabel: { color: "#8b98a5" } },
      yAxis: { type: "value", scale: true, axisLabel: { color: "#8b98a5", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#1f2a37" } } },
      series: curves.map((c, i) => ({
        name: `${c.label}（${c.date}）`,
        type: "line",
        data: c.values,
        symbol: "circle",
        symbolSize: 8,
        lineStyle: { width: 2, color: SERIES_COLORS[i] },
        itemStyle: { color: SERIES_COLORS[i], borderColor: "#121821", borderWidth: 2 },
      })),
    });
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [tenors, curves]);
  return <div ref={el} className="h-64 w-full" role="img" aria-label="国债收益率曲线：最新、3 个月前、12 个月前" />;
}
