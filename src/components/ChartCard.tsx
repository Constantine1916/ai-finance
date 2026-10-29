import Link from "next/link";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import type { SourceMeta } from "@/macro/build";
import type { ChartSpec } from "@/macro/charts";
import { ageText } from "@/pipeline/freshness";

// 图表卡片：标题、来源与数据日期、过期与待确认提示、版权说明，下方为按需加载的图表
const SOURCE_NAME: Record<string, string> = { fred: "FRED", treasury: "美国财政部", bls: "BLS", bea: "BEA", tiingo: "Tiingo", edgar: "SEC EDGAR", tsmc: "台积电 6-K", manual: "人工录入" };

// 同一来源、同一数据日期与状态的序列合并为一行，避免来源说明过长
function groupSources(sources: SourceMeta[]) {
  const groups = new Map<string, SourceMeta[]>();
  for (const s of sources) {
    const key = [s.source, s.lastObsDate, s.state, s.copyrightHolder].join("|");
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.values()];
}

export function SourceLine({ sources, now }: { sources: SourceMeta[]; now: Date }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
      {groupSources(sources).map((group) => {
        const s = group[0]!;
        const pending = group.reduce((n, g) => n + g.pending, 0);
        return (
          <p key={group.map((g) => g.id).join()}>
            {SOURCE_NAME[s.source] ?? s.source}{" "}
            {group.map((g, i) => (
              <span key={g.id}>
                {i > 0 && "、"}
                {g.sourceRef ? (
                  <a href={g.sourceRef} target="_blank" rel="noreferrer" className="underline" title="打开原始数据页面">
                    {g.id.split(":")[1]}
                  </a>
                ) : (
                  g.id.split(":")[1]
                )}
              </span>
            ))}{" "}
            · 数据截至 <span className="num">{s.lastObsDate ?? "—"}</span>
            {s.lastFetchedAt && ` · 抓取于 ${ageText(new Date(s.lastFetchedAt), now)}`}
            {s.state === "stale" && <span className="ml-1 text-[var(--warn)]">· ⚠ 过期（最晚应于 {s.expectedBy} 更新）</span>}
            {s.state === "empty" && <span className="ml-1 text-[var(--warn)]">· 暂无数据</span>}
            {pending > 0 && (
              <Link href="/data" className="ml-1 text-[var(--warn)] underline">
                · 有 {pending} 条待确认数据
              </Link>
            )}
            {s.copyrightHolder && <span> · © {s.copyrightHolder}，仅限个人使用</span>}
          </p>
        );
      })}
    </div>
  );
}

export function ChartCard({ spec, sources, now }: { spec: ChartSpec; sources: SourceMeta[]; now: Date }) {
  return (
    <article className="min-w-0 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
      <h3 className="font-medium">
        {spec.title} <span className="text-xs font-normal text-[var(--muted)]">{spec.unit}</span>
      </h3>
      <SourceLine sources={sources} now={now} />
      {spec.note && <p className="mt-1 text-xs text-[var(--muted)]">{spec.note}</p>}
      <div className="mt-2">
        <TimeSeriesChart meta={{ id: spec.id, title: spec.title, unit: spec.unit, annotations: spec.annotations ?? [], defaultRange: spec.defaultRange ?? "5y" }} />
      </div>
    </article>
  );
}
