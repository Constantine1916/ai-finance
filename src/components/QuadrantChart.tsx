"use client";

import { useEffect, useRef } from "react";
import { LineChart, ScatterChart } from "echarts/charts";
import { GraphicComponent, GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([ScatterChart, LineChart, GridComponent, TooltipComponent, GraphicComponent, CanvasRenderer]);

export interface TrailPoint {
  date: string;
  growth: number;
  inflation: number;
  name: string;
}

// 增长 × 通胀两轴的周期象限，带最近 12 个月轨迹；最新一点加大并标注月份
export default function QuadrantChart({ trail }: { trail: TrailPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current || trail.length === 0) return;
    const chart = echarts.init(el.current);
    const extent = Math.max(1, ...trail.flatMap((p) => [Math.abs(p.growth), Math.abs(p.inflation)])) * 1.25;
    const ink = "#8b98a5";
    const corner = (text: string, left: string, top: string) => ({ type: "text", left, top, style: { text, fill: "#5b6876", fontSize: 13 } });
    chart.setOption({
      animation: false,
      grid: { left: 48, right: 24, top: 24, bottom: 40 },
      tooltip: {
        backgroundColor: "#0b0f14",
        borderColor: "#1f2a37",
        textStyle: { color: "#e6edf3", fontSize: 12 },
        formatter: (p: { data: [number, number, string, string] }) => `${p.data[2].slice(0, 7)} · ${p.data[3]}<br/>增长动能 ${p.data[0].toFixed(2)}<br/>通胀动能 ${p.data[1].toFixed(2)}`,
      },
      xAxis: { type: "value", min: -extent, max: extent, name: "增长动能 →", nameLocation: "end", nameTextStyle: { color: ink }, axisLabel: { color: ink, formatter: (v: number) => v.toFixed(1) }, splitLine: { lineStyle: { color: "#1f2a37" } }, axisLine: { onZero: true, lineStyle: { color: "#5b6876" } } },
      yAxis: { type: "value", min: -extent, max: extent, name: "通胀动能 ↑", nameTextStyle: { color: ink }, axisLabel: { color: ink, formatter: (v: number) => v.toFixed(1) }, splitLine: { lineStyle: { color: "#1f2a37" } }, axisLine: { onZero: true, lineStyle: { color: "#5b6876" } } },
      graphic: [corner("过热", "78%", "8%"), corner("滞胀", "12%", "8%"), corner("衰退", "12%", "80%"), corner("复苏", "78%", "80%")],
      series: [
        { type: "line", data: trail.map((p) => [p.growth, p.inflation]), showSymbol: false, lineStyle: { color: "#3987e5", width: 1.5, opacity: 0.6 }, silent: true },
        {
          type: "scatter",
          data: trail.map((p) => [p.growth, p.inflation, p.date, p.name]),
          symbolSize: (_v: unknown, params: { dataIndex: number }) => (params.dataIndex === trail.length - 1 ? 14 : 8),
          itemStyle: { color: "#3987e5", borderColor: "#121821", borderWidth: 2 },
          label: { show: true, formatter: (p: { dataIndex: number; data: [number, number, string] }) => (p.dataIndex === trail.length - 1 || p.dataIndex === 0 ? p.data[2].slice(0, 7) : ""), color: "#e6edf3", fontSize: 11, position: "right" },
        },
      ],
    });
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [trail]);
  return <div ref={el} className="h-80 w-full" role="img" aria-label="增长与通胀两轴的周期象限及最近 12 个月轨迹" />;
}
