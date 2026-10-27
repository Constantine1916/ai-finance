import { getDb } from "@/db/client";
import EventTable from "@/calendar/EventTable";
import { eventsWithStatus } from "@/calendar/status";
import { requireOwner } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const input = "rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requireOwner();
  const { msg, error } = await searchParams;
  const now = new Date();
  const rows = await eventsWithStatus(getDb(), new Date(now.getTime() - 30 * 86_400_000), new Date(now.getTime() + 90 * 86_400_000), now);
  const past = rows.filter((r) => r.scheduledAt <= now).reverse();
  const upcoming = rows.filter((r) => r.scheduledAt > now);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">事件日历</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        FOMC 来自美联储日历，PCE 来自 BEA 发布日历，CPI、非农与初请失业金来自 FRED 收录的官方发布日期（时间按惯例美东 8:30）。采集进程每天同步一次，发布当天自动追加采集。
      </p>
      {msg && <p className="mt-2 text-sm text-[var(--up)]">{msg}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--down)]">
          {error}
        </p>
      )}

      <section className="mt-6 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
        <h2 className="font-medium">未来 90 天（{upcoming.length}）</h2>
        <EventTable rows={upcoming} allowDelete />
      </section>

      <section className="mt-4 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
        <h2 className="font-medium">添加财报日期</h2>
        <form method="post" action="/api/events" className="mt-3 flex flex-wrap items-end gap-3 text-sm">
          <label className="grid gap-1">
            代码
            <input name="symbol" required placeholder="NVDA" className={`${input} w-24 uppercase`} />
          </label>
          <label className="grid gap-1">
            日期
            <input name="date" type="date" required className={input} />
          </label>
          <label className="grid gap-1">
            时间（美东）
            <select name="timing" className={input} defaultValue="amc">
              <option value="amc">盘后</option>
              <option value="bmo">盘前</option>
              <option value="time">指定时间</option>
            </select>
          </label>
          <label className="grid gap-1">
            指定时间
            <input name="time" type="time" className={input} />
          </label>
          <label className="grid min-w-64 flex-1 gap-1">
            来源链接（必填，如公司投资者关系页）
            <input name="sourceUrl" type="url" required placeholder="https://" className={input} />
          </label>
          <label className="flex items-center gap-1 pb-1">
            <input name="confirmed" type="checkbox" defaultChecked /> 公司已确认
          </label>
          <button type="submit" className="rounded bg-[var(--text)] px-3 py-1 text-[var(--bg)]">
            保存
          </button>
        </form>
      </section>

      <section className="mt-4 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
        <h2 className="font-medium">过去 30 天</h2>
        <EventTable rows={past} />
      </section>
    </main>
  );
}
