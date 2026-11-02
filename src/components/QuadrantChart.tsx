"use client";

import { useEffect, useRef } from "react";
import { LineChart, ScatterChart } from "echarts/charts";
import { GraphicComponent, GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { axisLabel, INK, monoFamily, SERIES_COLORS, tooltipStyle } from "./chartTheme";

echarts.use([ScatterChart, LineChart, GridComponent, TooltipComponent, GraphicComponent, CanvasRenderer]);

export interface TrailPoint {
  date: string;
  growth: number;
  inflation: number;
  name: string;
}

// 增长 × 通胀两轴的周期象限，带最近 12 个月轨迹；最新一点加大并标注月份，所在象限的名称点亮
export default function QuadrantChart({ trail }: { trail: TrailPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current || trail.length === 0) return;
    const chart = echarts.init(el.current);
    const extent = Math.max(1, ...trail.flatMap((p) => [Math.abs(p.growth), Math.abs(p.inflation)])) * 1.25;
    const current = trail.at(-1)?.name;
    const corner = (text: string, left: string, top: string) => ({
      type: "text",
      left,
      top,
      style: { text, fill: text === current ? INK.primary : INK.faint, fontSize: 14, fontWeight: text === current ? 600 : 400 },
    });
    const axis = (name: string) => ({
      type: "value",
      min: -extent,
      max: extent,
      name,
      nameTextStyle: { color: INK.muted, fontSize: 11 },
      axisLabel: axisLabel({ formatter: (v: number) => v.toFixed(1) }),
      splitLine: { lineStyle: { color: INK.grid } },
      axisLine: { onZero: true, lineStyle: { color: INK.faint } },
    });
    const blue = SERIES_COLORS[0];
    chart.setOption({
      animation: false,
      grid: { left: 48, right: 24, top: 40, bottom: 40 },
      tooltip: {
        ...tooltipStyle(),
        formatter: (p: { data: [number, number, string, string] }) => `${p.data[2].slice(0, 7)} · ${p.data[3]}<br/>增长动能 ${p.data[0].toFixed(2)}<br/>通胀动能 ${p.data[1].toFixed(2)}`,
      },
      xAxis: { ...axis("增长动能 →"), nameLocation: "end" },
      yAxis: axis("通胀动能 ↑"),
      graphic: [corner("过热", "80%", "16%"), corner("滞胀", "16%", "16%"), corner("衰退", "16%", "78%"), corner("复苏", "80%", "78%")],
      series: [
        { type: "line", data: trail.map((p) => [p.growth, p.inflation]), showSymbol: false, lineStyle: { color: blue, width: 1.5, opacity: 0.55 }, silent: true },
        {
          type: "scatter",
          data: trail.map((p) => [p.growth, p.inflation, p.date, p.name]),
          symbolSize: (_v: unknown, params: { dataIndex: number }) => (params.dataIndex === trail.length - 1 ? 14 : 8),
          itemStyle: { color: blue, borderColor: INK.panel, borderWidth: 2 },
          label: {
            show: true,
            formatter: (p: { dataIndex: number; data: [number, number, string] }) => (p.dataIndex === trail.length - 1 || p.dataIndex === 0 ? p.data[2].slice(0, 7) : ""),
            color: INK.primary,
            fontSize: 11,
            fontFamily: monoFamily(),
            position: "right",
          },
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
