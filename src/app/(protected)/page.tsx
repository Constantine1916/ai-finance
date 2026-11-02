import Link from "next/link";
import { getDb } from "@/db/client";
import EventTable from "@/calendar/EventTable";
import { eventsWithStatus } from "@/calendar/status";
import QuadrantChart from "@/components/QuadrantChart";
import { requireOwner } from "@/lib/auth/guard";
import { sourceMeta } from "@/macro/build";
import { readSeries } from "@/pipeline/store";
import { evaluateAll } from "@/signals/engine";
import { num, signed, StateBadge, STATE_STYLE } from "@/signals/display";
import { QUADRANT_FORMULA, quadrantTrail } from "@/signals/quadrant";

export const dynamic = "force-dynamic";

const etDate = (d: Date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

export default async function Home() {
  await requireOwner();
  const db = getDb();
  const now = new Date();
  const toPoints = (rows: { obsDate: string; value: number }[]) => rows.map((r) => ({ date: r.obsDate, value: r.value }));
  const [evaluations, industrial, coreCpi, axisMeta, upcoming] = await Promise.all([
    evaluateAll(db, now),
    readSeries(db, "fred:INDPRO"),
    readSeries(db, "fred:CPILFESL"),
    sourceMeta(db, ["fred:INDPRO", "fred:CPILFESL"], now),
    eventsWithStatus(db, new Date(now.getTime() - 2 * 86_400_000), new Date(now.getTime() + 30 * 86_400_000), now),
  ]);
  const trail = quadrantTrail(toPoints(industrial), toPoints(coreCpi));
  const latest = trail.at(-1);
  const staleAxis = axisMeta.filter((m) => m.state !== "fresh");

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <p className="eyebrow">美东 {etDate(now)} · 规则评估</p>
      <h1 className="page-title mt-2">总览</h1>
      <p className="page-lede">
        每块灯牌是一条公开规则：绿点为正常，灯牌亮琥珀色为关注、亮红色为警示。信号不合成综合评分，也不给出仓位或买卖建议；加仓、持有还是降低仓位由你决定。点开灯牌可看规则与历史表现（包括没有应验的触发）。
      </p>

      <section aria-label="信号灯牌" className="annunciator mt-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {evaluations.map((e, i) => {
          const state = e.provisional?.state ?? e.state;
          const value = e.provisional?.value ?? e.current?.value;
          return (
            <Link key={e.rule.id} href={`/signals/${e.rule.id}`} className={`lamp lamp-${state}`} style={{ "--i": i } as React.CSSProperties}>
              <span className="flex items-center justify-between gap-2">
                <span className="lamp-state">
                  {STATE_STYLE[state].label}
                  {e.provisional && " · 盘中暂定"}
                </span>
                <span className="mono text-[11px] text-[var(--faint)]">{e.provisional ? "盘中" : e.current?.date ?? "—"}</span>
              </span>
              <span className="mt-2 text-[15px] font-medium leading-snug">{e.rule.name}</span>
              <span className="mt-auto flex items-end justify-between gap-2 pt-3">
                <span className="num text-2xl font-medium leading-none">{num(value)}</span>
                <span className="num text-xs text-[var(--muted)]" title="较 3 个月前">
                  {e.change === null || e.change === undefined ? "" : `3 月 ${signed(e.change)}`}
                </span>
              </span>
              <span className="mt-1 truncate text-[11px] text-[var(--muted)]">{e.rule.unit}</span>
              {e.provisional && e.provisional.state !== e.state && (
                <span className="mt-1 text-[11px] text-[var(--muted)]">
                  收盘确认：<StateBadge state={e.state} />
                </span>
              )}
            </Link>
          );
        })}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="panel lg:col-span-2">
          <h2 className="panel-title">周期象限</h2>
          {latest ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              当前处于 <span className="font-display text-lg font-semibold text-[var(--text)]">{latest.name}</span>
              <span className="num ml-2 text-xs">
                {latest.date.slice(0, 7)} · 增长 {signed(latest.growth)} · 通胀 {signed(latest.inflation)}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--muted)]">数据不足，无法计算。</p>
          )}
          {staleAxis.map((m) => (
            <p key={m.id} className="mt-1 text-xs text-[var(--warn)]">
              ⚠ {m.nameZh} {m.state === "stale" ? `已过期（最新 ${m.lastObsDate}）` : "暂无数据"}，象限停在最后可用的月份，不外推
            </p>
          ))}
          <QuadrantChart trail={trail} />
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            {QUADRANT_FORMULA} 两轴数据截至 {axisMeta.map((m) => `${m.nameZh} ${m.lastObsDate}`).join("、")}。
          </p>
        </section>

        <section className="panel lg:col-span-3">
          <h2 className="panel-title flex items-baseline justify-between">
            未来 30 天
            <Link href="/calendar" className="link text-xs font-normal text-[var(--muted)]">
              完整日历
            </Link>
          </h2>
          <EventTable rows={upcoming} />
        </section>
      </div>

      <section className="panel mt-4">
        <h2 className="panel-title">规则明细</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="tbl w-full min-w-[620px] text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left">信号</th>
                <th className="px-2 py-1.5 text-left">状态</th>
                <th className="px-2 py-1.5 text-right">当前值</th>
                <th className="px-2 py-1.5 text-left">警示规则</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((e) => (
                <tr key={e.rule.id} className="align-top">
                  <td className="px-2 py-2">
                    <Link href={`/signals/${e.rule.id}`} className="link">
                      {e.rule.name}
                    </Link>
                    {e.overridden && <span className="block text-xs text-[var(--muted)]">已自定义阈值</span>}
                  </td>
                  <td className="px-2 py-2">
                    <StateBadge state={e.provisional?.state ?? e.state} provisional={Boolean(e.provisional)} />
                    {e.reason && <span className="block text-xs text-[var(--muted)]">{e.reason}</span>}
                  </td>
                  <td className="num whitespace-nowrap px-2 py-2 text-right">
                    {num(e.provisional?.value ?? e.current?.value)}
                    <span className="block text-xs text-[var(--muted)]">{e.provisional ? "盘中" : e.current?.date}</span>
                  </td>
                  <td className="px-2 py-2 text-xs leading-relaxed text-[var(--muted)]">{e.rule.describe(e.params).warning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
