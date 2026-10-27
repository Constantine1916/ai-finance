import Link from "next/link";
import { and, asc, gte, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { events } from "@/db/schema";
import QuadrantChart from "@/components/QuadrantChart";
import { requireOwner } from "@/lib/auth/guard";
import { sourceMeta } from "@/macro/build";
import { readSeries } from "@/pipeline/store";
import { evaluateAll } from "@/signals/engine";
import { num, signed, StateBadge } from "@/signals/display";
import { QUADRANT_FORMULA, quadrantTrail } from "@/signals/quadrant";

export const dynamic = "force-dynamic";

const bj = (d: Date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const et = (d: Date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "America/New_York", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

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
    db.select().from(events).where(and(gte(events.scheduledAt, now), lte(events.scheduledAt, new Date(now.getTime() + 30 * 86_400_000)))).orderBy(asc(events.scheduledAt)),
  ]);
  const trail = quadrantTrail(toPoints(industrial), toPoints(coreCpi));
  const latest = trail.at(-1);
  const staleAxis = axisMeta.filter((m) => m.state !== "fresh");

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">总览</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        信号只是按公开规则作出的判断，不合成综合评分，也不给出仓位或买卖建议；加仓、持有还是降低仓位由你决定。每条规则的历史表现（包括没有应验的触发）见详情页。
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="rounded border border-[var(--border)] bg-[var(--panel)] p-3 lg:col-span-2">
          <h2 className="font-medium">周期象限</h2>
          {latest ? (
            <p className="mt-1 text-sm">
              当前：<span className="font-semibold">{latest.name}</span>
              <span className="text-[var(--muted)]">（{latest.date.slice(0, 7)}，增长动能 {signed(latest.growth)}，通胀动能 {signed(latest.inflation)}）</span>
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
          <p className="mt-1 text-xs text-[var(--muted)]">
            {QUADRANT_FORMULA} 两轴数据截至 {axisMeta.map((m) => `${m.nameZh} ${m.lastObsDate}`).join("、")}。
          </p>
        </section>

        <section className="min-w-0 rounded border border-[var(--border)] bg-[var(--panel)] p-3 lg:col-span-3">
          <h2 className="font-medium">信号灯</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-xs text-[var(--muted)]">
                  <th className="px-2 py-1 text-left font-normal">信号</th>
                  <th className="px-2 py-1 text-left font-normal">状态</th>
                  <th className="px-2 py-1 text-right font-normal">当前值</th>
                  <th className="px-2 py-1 text-right font-normal">较 3 个月前</th>
                  <th className="px-2 py-1 text-left font-normal">警示规则</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((e) => (
                  <tr key={e.rule.id} className="border-t border-[var(--border)] align-top">
                    <td className="px-2 py-1.5">
                      <Link href={`/signals/${e.rule.id}`} className="underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--text)]">
                        {e.rule.name}
                      </Link>
                      {e.overridden && <span className="block text-xs text-[var(--muted)]">已自定义阈值</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <StateBadge state={e.provisional?.state ?? e.state} provisional={Boolean(e.provisional)} />
                      {e.provisional && e.provisional.state !== e.state && (
                        <span className="block text-xs text-[var(--muted)]">
                          收盘确认：<StateBadge state={e.state} />
                        </span>
                      )}
                      {e.reason && <span className="block text-xs text-[var(--muted)]">{e.reason}</span>}
                    </td>
                    <td className="num px-2 py-1.5 text-right">
                      {num(e.provisional?.value ?? e.current?.value)}
                      <span className="block text-xs text-[var(--muted)]">{e.rule.unit}</span>
                      <span className="block text-xs text-[var(--muted)]">{e.provisional ? "盘中" : e.current?.date}</span>
                    </td>
                    <td className="num px-2 py-1.5 text-right">{signed(e.change)}</td>
                    <td className="px-2 py-1.5 text-xs text-[var(--muted)]">{e.rule.describe(e.params).warning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">云厂商资本开支与台积电月营收两条规则在 1B 阶段接入数据后加入。</p>
        </section>
      </div>

      <section className="mt-4 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
        <h2 className="font-medium">未来 30 天</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">暂无日程。</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <tbody>
              {upcoming.map((ev) => (
                <tr key={ev.id} className="border-t border-[var(--border)]">
                  <td className="num whitespace-nowrap px-2 py-1">北京 {bj(ev.scheduledAt)}</td>
                  <td className="num whitespace-nowrap px-2 py-1 text-[var(--muted)]">美东 {et(ev.scheduledAt)}</td>
                  <td className="px-2 py-1">
                    {ev.title}
                    {!ev.confirmed && <span className="ml-1 text-xs text-[var(--muted)]">（未确认）</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
