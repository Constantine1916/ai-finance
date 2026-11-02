// 图表共用的颜色与字体，与 globals.css 的配色一致
// 分类色按固定顺序分配，已用 dataviz 校验脚本对 #1a2226 面板验证（色觉缺陷区分度、对比度均通过）
export const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500"];

export const INK = {
  primary: "#e8e2d4",
  muted: "#8e9a9d",
  faint: "#5e6b6f",
  grid: "#2a363c",
  panel: "#1a2226",
  tooltip: "#0e1315",
  shade: "rgba(229, 72, 77, 0.13)",
};

// next/font 生成的字体名带哈希，只能在浏览器里从 CSS 变量读取
export function monoFamily() {
  if (typeof window === "undefined") return "monospace";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
  return v ? `${v}, ui-monospace, monospace` : "ui-monospace, monospace";
}

export function tooltipStyle() {
  return {
    backgroundColor: INK.tooltip,
    borderColor: INK.grid,
    textStyle: { color: INK.primary, fontSize: 12, fontFamily: monoFamily() },
  };
}

export function axisLabel(extra: Record<string, unknown> = {}) {
  return { color: INK.muted, fontFamily: monoFamily(), fontSize: 11, ...extra };
}
