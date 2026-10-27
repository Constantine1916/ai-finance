import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { requireOwner } from "@/lib/auth/guard";
import { evaluateRule, paramHistory, stateLog, trackRecord } from "@/signals/engine";
import { num, signed, StateBadge } from "@/signals/display";
import { defaultParams, RULE_MAP } from "@/signals/rules";
import type { Forward } from "@/signals/track";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "short" }).format(d);
const cells = (f: Forward) =>
  [f.r3m, f.r6m, f.r12m, f.maxDrop12m].map((v, i) => (
    <td key={i} className={`num px-2 py-1 text-right ${v === null ? "text-[var(--muted)]" : v < 0 ? "text-[var(--down)]" : ""}`}>
      {v === null ? "数据不足" : `${signed(v, 1)}%`}
    </td>
  ));

export default async function SignalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requireOwner();
  const { id } = await params;
  const { msg, error } = await searchParams;
  const rule = RULE_MAP.get(id);
  if (!rule) notFound();
  const db = getDb();
  const e = await evaluateRule(db, rule);
  const [track, log, history] = await Promise.all([trackRecord(db, e), stateLog(db, id), paramHistory(db, id)]);
  const text = rule.describe(e.params);
  const defaults = defaultParams(rule);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-sm">
      <Link href="/" className="text-[var(--muted)] hover:text-[var(--text)]">
        ← 总览
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{rule.name}</h1>
      {msg && <p className="mt-2 text-[var(--up)]">{msg}</p>}
      {error && (
        <p role="alert" className="mt-2 text-[var(--down)]">
          {error}
        </p>
      )}
      <p className="mt-3">
        当前状态：<StateBadge state={e.state} />
        {e.current && (
          <span className="text-[var(--muted)]">
            {" "}
            · {num(e.current.value)} {rule.unit}（{e.current.date}）
          </span>
        )}
      </p>
      {e.provisional && (
        <p className="mt-1">
          盘中暂定：<StateBadge state={e.provisional.state} provisional /> <span className="text-[var(--muted)]">{num(e.provisional.value)}，收盘确认后才记入日志</span>
        </p>
      )}
      {e.reason && <p className="mt-1 text-[var(--muted)]">原因：{e.reason}</p>}

      <section className="mt-6 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
        <h2 className="font-medium">规则（版本 {rule.version}）</h2>
        <p className="mt-2">■ 警示：{text.warning}</p>
        <p className="mt-1">▲ 关注：{text.watch}</p>
        <p className="mt-1 text-[var(--muted)]">● 其余情况为正常。任一输入缺失、过期或最新一期待确认时显示数据不足。</p>
        <form method="post" action={`/api/signals/${rule.id}`} className="mt-4 flex flex-wrap items-end gap-3">
          {Object.entries(rule.params).map(([key, spec]) => (
            <label key={key} className="grid gap-1">
              <span>
                {spec.label}
                {spec.unit && `（${spec.unit}）`}
                <span className="text-xs text-[var(--muted)]"> 默认 {defaults[key]}</span>
              </span>
              <input name={key} defaultValue={e.params[key]} inputMode="decimal" required className="num w-32 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1" />
            </label>
          ))}
          <button type="submit" className="rounded bg-[var(--text)] px-3 py-1 text-[var(--bg)]">
            保存阈值
          </button>
          <button type="submit" name="action" value="reset" formNoValidate className="rounded border border-[var(--border)] px-3 py-1">
            恢复默认
          </button>
        </form>
        {history.length > 0 && (
          <details className="mt-3 text-xs text-[var(--muted)]">
            <summary>阈值修改记录（{history.length}）</summary>
            <ul className="mt-1 space-y-0.5">
              {history.map((h) => (
                <li key={h.id}>
                  {fmt(h.changedAt)}：{Object.entries(h.params as Record<string, number>).map(([k, v]) => `${rule.params[k]?.label ?? k} ${v}`).join("，")}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="mt-4 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
        <h2 className="font-medium">历史表现</h2>
        <p className="mt-1 text-[var(--muted)]">
          共触发 {track.rows.length} 次（两次触发至少间隔 90 天）。
          {track.spy.evaluated > 0 &&
            ` 有完整 12 个月数据的 ${track.spy.evaluated} 次中，SPY 12 个月后下跌 ${track.spy.negative12m} 次，12 个月收益中位数 ${signed(track.spy.median12m, 1)}%。`}
          价格数据（Tiingo 复权价）SPY 始于 {track.priceStart.spy}、SOXX 始于 {track.priceStart.soxx}，更早的触发显示数据不足。
        </p>
        {rule.revisedInputs && <p className="mt-1 text-[var(--warn)]">⚠ 输入序列会被事后修订，历史触发按修订后的数据计算，存在前视偏差：当时实际公布的数据可能不会触发。</p>}
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="text-xs text-[var(--muted)]">
                <th className="px-2 py-1 text-left font-normal">触发日</th>
                <th className="px-2 py-1 text-right font-normal">SPY 3 个月</th>
                <th className="px-2 py-1 text-right font-normal">6 个月</th>
                <th className="px-2 py-1 text-right font-normal">12 个月</th>
                <th className="px-2 py-1 text-right font-normal">12 个月内最大跌幅</th>
                <th className="px-2 py-1 text-right font-normal">SOXX 3 个月</th>
                <th className="px-2 py-1 text-right font-normal">6 个月</th>
                <th className="px-2 py-1 text-right font-normal">12 个月</th>
                <th className="px-2 py-1 text-right font-normal">12 个月内最大跌幅</th>
              </tr>
            </thead>
            <tbody>
              {[...track.rows].reverse().map((r) => (
                <tr key={r.date} className="border-t border-[var(--border)]">
                  <td className="num px-2 py-1">{r.date}</td>
                  {cells(r.spy)}
                  {cells(r.soxx)}
                </tr>
              ))}
            </tbody>
          </table>
          {track.rows.length === 0 && <p className="mt-2 text-[var(--muted)]">历史上没有触发过。</p>}
        </div>
      </section>

      <section className="mt-4 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
        <h2 className="font-medium">状态变化日志</h2>
        {log.length === 0 ? (
          <p className="mt-2 text-[var(--muted)]">尚无记录。采集进程每小时评估一次，状态变化时记录。</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {log.map((l) => {
              const inputs = l.inputs as { value: number | null; date: string | null };
              return (
                <li key={l.id}>
                  {fmt(l.changedAt)}：{l.previousState ? <StateBadge state={l.previousState as "normal"} /> : "（首次记录）"} → <StateBadge state={l.state as "normal"} />
                  <span className="text-[var(--muted)]">
                    {" "}
                    · 当时数值 {num(inputs.value)}（{inputs.date ?? "—"}），规则版本 {l.ruleVersion}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
