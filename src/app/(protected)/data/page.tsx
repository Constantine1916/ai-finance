import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { series } from "@/db/schema";
import { requireOwner } from "@/lib/auth/guard";
import { ageText } from "@/pipeline/freshness";
import { latestRunsByJob, pendingList, seriesFreshness, workerAlive } from "@/pipeline/health";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "short" }).format(d) : "—";

const stateText = { fresh: "正常", stale: "过期", empty: "暂无数据" } as const;
const statusText: Record<string, string> = { success: "成功", failed: "失败", skipped: "跳过（未配置）", running: "运行中" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </section>
  );
}

const th = "border-b border-[var(--border)] px-2 py-1 text-left font-normal text-[var(--muted)]";
const td = "border-b border-[var(--border)] px-2 py-1 align-top";

export default async function DataHealthPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requireOwner();
  const { msg, error } = await searchParams;
  const db = getDb();
  const now = new Date();
  const [worker, runs, pending, fresh, manualSeries] = await Promise.all([
    workerAlive(db, now),
    latestRunsByJob(db),
    pendingList(db),
    seriesFreshness(db, now),
    db.select().from(series).where(eq(series.source, "manual")),
  ]);
  const problems = fresh.filter((f) => f.state !== "fresh");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-sm">
      <h1 className="text-2xl font-semibold">数据健康</h1>
      {msg && <p className="mt-3 text-[var(--up)]">{msg}</p>}
      {error && (
        <p role="alert" className="mt-3 text-[var(--down)]">
          {error}
        </p>
      )}

      <p className="mt-4">
        采集进程：
        {worker.alive ? (
          <span className="text-[var(--up)]">运行中（心跳 {worker.lastBeat ? ageText(worker.lastBeat, now) : "—"}）</span>
        ) : (
          <span className="text-[var(--down)]">无心跳{worker.lastBeat ? `，最后一次 ${fmt(worker.lastBeat)}` : ""}</span>
        )}
      </p>

      <Section title="采集任务">
        {runs.length === 0 ? (
          <p className="text-[var(--muted)]">尚无运行记录。</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>任务</th>
                <th className={th}>最近状态</th>
                <th className={th}>最近成功</th>
                <th className={th}>最近失败及原因</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.job}>
                  <td className={td}>{r.job}</td>
                  <td className={td}>{statusText[r.latest.status] ?? r.latest.status}</td>
                  <td className={td}>{fmt(r.lastSuccess?.finishedAt)}</td>
                  <td className={`${td} whitespace-pre-wrap text-[var(--down)]`}>
                    {r.lastFailure ? `${fmt(r.lastFailure.finishedAt)}\n${r.lastFailure.error ?? ""}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`待确认观测（${pending.length}）`}>
        {pending.length === 0 ? (
          <p className="text-[var(--muted)]">没有待确认的数据。</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>序列</th>
                <th className={th}>数据日期</th>
                <th className={th}>数值</th>
                <th className={th}>原因</th>
                <th className={th}>来源</th>
                <th className={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={`${p.seriesId}-${p.obsDate}`}>
                  <td className={td}>{p.nameZh}</td>
                  <td className={`${td} num`}>{p.obsDate}</td>
                  <td className={`${td} num`}>
                    {p.value} {p.unit}
                  </td>
                  <td className={td}>{(p.issues as { message: string }[]).map((i) => i.message).join("；")}</td>
                  <td className={td}>
                    <a href={p.sourceRef} className="underline" target="_blank" rel="noreferrer">
                      原始链接
                    </a>
                  </td>
                  <td className={td}>
                    {(["confirm", "discard"] as const).map((action) => (
                      <form key={action} method="post" action="/api/pending" className="inline">
                        <input type="hidden" name="seriesId" value={p.seriesId} />
                        <input type="hidden" name="obsDate" value={p.obsDate} />
                        <input type="hidden" name="action" value={action} />
                        <button type="submit" className="mr-2 underline">
                          {action === "confirm" ? "确认" : "删除"}
                        </button>
                      </form>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`过期或无数据的序列（${problems.length} / ${fresh.length}）`}>
        {problems.length === 0 ? (
          <p className="text-[var(--muted)]">{fresh.length === 0 ? "尚未登记任何序列。" : "所有序列都在预期时间内更新。"}</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>序列</th>
                <th className={th}>状态</th>
                <th className={th}>最新数据日期</th>
                <th className={th}>最晚应更新</th>
                <th className={th}>最近抓取</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((f) => (
                <tr key={f.id}>
                  <td className={td}>{f.nameZh}</td>
                  <td className={`${td} ${f.state === "stale" ? "text-[var(--warn)]" : "text-[var(--muted)]"}`}>{stateText[f.state]}</td>
                  <td className={`${td} num`}>{f.lastObsDate ?? "—"}</td>
                  <td className={`${td} num`}>{f.expectedBy ?? "—"}</td>
                  <td className={td}>{fmt(f.lastFetchedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="人工录入">
        {manualSeries.length === 0 ? (
          <p className="text-[var(--muted)]">暂无需要人工录入的序列（存储价格、云业务增速等在 1B 阶段登记）。</p>
        ) : (
          <form method="post" action="/api/manual-entries" className="grid max-w-xl gap-3">
            <label className="grid gap-1">
              序列
              <select name="seriesId" required className="rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1">
                {manualSeries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameZh}（{s.unit}）
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              数据日期
              <input name="obsDate" type="date" required className="rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1" />
            </label>
            <label className="grid gap-1">
              数值
              <input name="value" inputMode="decimal" required className="rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1" />
            </label>
            <label className="grid gap-1">
              单位（须与序列登记单位一致）
              <input name="unit" required className="rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1" />
            </label>
            <label className="grid gap-1">
              来源链接（必填）
              <input name="sourceUrl" type="url" required placeholder="https://" className="rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1" />
            </label>
            <label className="grid gap-1">
              备注
              <input name="note" className="rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1" />
            </label>
            <button type="submit" className="w-fit rounded bg-[var(--text)] px-3 py-1 text-[var(--bg)]">
              保存
            </button>
          </form>
        )}
      </Section>
    </main>
  );
}
