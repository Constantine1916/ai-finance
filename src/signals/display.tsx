import type { DisplayState } from "./engine";

// 状态一律同时显示图标与文字，不只靠颜色区分
export const STATE_STYLE: Record<DisplayState, { icon: string; label: string; className: string }> = {
  normal: { icon: "●", label: "正常", className: "text-[var(--up)]" },
  watch: { icon: "▲", label: "关注", className: "text-[var(--warn)]" },
  warning: { icon: "■", label: "警示", className: "text-[var(--down)]" },
  insufficient: { icon: "？", label: "数据不足", className: "text-[var(--muted)]" },
};

export function StateBadge({ state, provisional = false }: { state: DisplayState; provisional?: boolean }) {
  const s = STATE_STYLE[state];
  return (
    <span className={`whitespace-nowrap ${s.className}`}>
      {s.icon} {s.label}
      {provisional && <span className="text-xs text-[var(--muted)]">（盘中暂定）</span>}
    </span>
  );
}

export const num = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? "—" : v.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits }));
export const signed = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${num(v, digits)}`);
