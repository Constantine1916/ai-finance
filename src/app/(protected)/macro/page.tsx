import Link from "next/link";
import { getDb } from "@/db/client";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import YieldCurveChart from "@/components/YieldCurveChart";
import { requireOwner } from "@/lib/auth/guard";
import { lineSourceIds, sourceMeta, type SourceMeta } from "@/macro/build";
import { SECTIONS, type ChartSpec } from "@/macro/charts";
import { CURVE_TENORS, etfTable, yieldCurves } from "@/macro/market";
import { ageText } from "@/pipeline/freshness";

export const dynamic = "force-dynamic";

const SOURCE_NAME: Record<string, string> = { fred: "FRED", treasury: "美国财政部", bls: "BLS", bea: "BEA", tiingo: "Tiingo", manual: "人工录入" };

// 同一来源、同一数据日期与状态的序列合并为一行，避免来源说明过长
function groupSources(sources: SourceMeta[]) {
  const groups = new Map<string, SourceMeta[]>();
  for (const s of sources) {
    const key = [s.source, s.lastObsDate, s.state, s.copyrightHolder].join("|");
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.values()];
}

function SourceLine({ sources, now }: { sources: SourceMeta[]; now: Date }) {
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

function ChartCard({ spec, sources, now }: { spec: ChartSpec; sources: SourceMeta[]; now: Date }) {
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

const pctText = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
const tone = (v: number | null) => (v === null ? "" : v >= 0 ? "text-[var(--up)]" : "text-[var(--down)]");
const etTime = (d: Date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

export default async function MacroPage() {
  await requireOwner();
  const db = getDb();
  const now = new Date();
  const allIds = [...new Set(SECTIONS.flatMap((s) => s.charts.flatMap((c) => c.lines.flatMap(lineSourceIds))))];
  const [metas, curves, etfs] = await Promise.all([sourceMeta(db, allIds, now), yieldCurves(db), etfTable(db, now)]);
  const metaFor = (spec: ChartSpec) => [...new Set(spec.lines.flatMap(lineSourceIds))].map((id) => metas.find((m) => m.id === id)).filter((m): m is SourceMeta => Boolean(m));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">宏观看板</h1>
      <nav className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="hover:text-[var(--text)]">
            {s.title}
          </a>
        ))}
      </nav>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="mt-10 scroll-mt-4">
          <h2 className="text-lg font-semibold">{section.title}</h2>

          {section.id === "rates" && curves.length > 0 && (
            <article className="mt-4 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
              <h3 className="font-medium">
                收益率曲线 <span className="text-xs font-normal text-[var(--muted)]">%</span>
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">最新、约 3 个月前、约 12 个月前（各取不晚于目标日期、所有期限都有数据的最近交易日）。来源：FRED，最新交易日取自美国财政部。</p>
              <YieldCurveChart tenors={CURVE_TENORS.map((t) => t.label)} curves={curves} />
            </article>
          )}

          {section.id === "market" && (
            <div className="mt-4 overflow-x-auto rounded border border-[var(--border)] bg-[var(--panel)] p-3">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-xs text-[var(--muted)]">
                    <th className="px-2 py-1 text-left font-normal">代码</th>
                    <th className="px-2 py-1 text-right font-normal">最新价</th>
                    <th className="px-2 py-1 text-right font-normal">距 200 日线</th>
                    <th className="px-2 py-1 text-right font-normal">距 52 周高点</th>
                    <th className="px-2 py-1 text-right font-normal">1 个月</th>
                    <th className="px-2 py-1 text-right font-normal">3 个月</th>
                    <th className="px-2 py-1 text-right font-normal">年初至今</th>
                  </tr>
                </thead>
                <tbody>
                  {etfs.map((e) => (
                    <tr key={e.symbol} className="border-t border-[var(--border)]">
                      <td className="px-2 py-1">
                        {e.symbol} <span className="text-xs text-[var(--muted)]">{e.name}</span>
                        {e.proxy && <span className="block text-xs text-[var(--muted)]">{e.proxy}</span>}
                      </td>
                      <td className="num px-2 py-1 text-right">
                        {e.price === null ? "—" : e.price.toFixed(2)}
                        <span className="block whitespace-nowrap text-xs text-[var(--muted)]">
                          {e.view.kind === "provisional" ? `盘中暂定 · 美东 ${etTime(e.view.capturedAt)}` : e.view.kind === "official" ? `收盘 ${e.view.obsDate}` : "暂无数据"}
                        </span>
                      </td>
                      {[e.vs200, e.dd52w, e.r1m, e.r3m, e.ytd].map((v, i) => (
                        <td key={i} className={`num px-2 py-1 text-right ${tone(v)}`}>
                          {pctText(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-[var(--muted)]">
                复权价由 Tiingo 未复权收盘价、分红与拆股计算。交易时段内最新价来自 Finnhub 每 5 分钟的盘中快照，标为暂定，收盘后以收盘价为准。VIX 等指数没有免费盘中数据，显示最近的正式数据日期。
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {section.charts.map((spec) => (
              <ChartCard key={spec.id} spec={spec} sources={metaFor(spec)} now={now} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
