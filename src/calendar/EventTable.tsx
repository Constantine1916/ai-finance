import Link from "next/link";
import { KIND_LINK, STATUS_TEXT, type EventStatus } from "./status";

const bj = (d: Date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const et = (d: Date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "America/New_York", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

const statusClass: Record<EventStatus, string> = { upcoming: "text-[var(--muted)]", released: "text-[var(--up)]", awaiting: "text-[var(--warn)]", delayed: "text-[var(--warn)]", held: "text-[var(--muted)]" };

export interface EventRow {
  key: string;
  origin: string;
  title: string;
  kind: string;
  scheduledAt: Date;
  sourceUrl: string;
  confirmed: boolean;
  note: string | null;
  displayStatus: EventStatus;
}

export default function EventTable({ rows, allowDelete = false }: { rows: EventRow[]; allowDelete?: boolean }) {
  if (rows.length === 0) return <p className="mt-2 text-sm text-[var(--muted)]">暂无日程。</p>;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-xs text-[var(--muted)]">
            <th className="px-2 py-1 text-left font-normal">北京时间</th>
            <th className="px-2 py-1 text-left font-normal">美东时间</th>
            <th className="px-2 py-1 text-left font-normal">事件</th>
            <th className="px-2 py-1 text-left font-normal">状态</th>
            <th className="px-2 py-1 text-left font-normal">来源</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.key} className="border-t border-[var(--border)] align-top">
              <td className="num whitespace-nowrap px-2 py-1">{bj(e.scheduledAt)}</td>
              <td className="num whitespace-nowrap px-2 py-1 text-[var(--muted)]">{et(e.scheduledAt)}</td>
              <td className="px-2 py-1">
                {e.title}
                {!e.confirmed && <span className="ml-1 text-xs text-[var(--warn)]">（未确认）</span>}
                {e.note && <span className="block text-xs text-[var(--muted)]">{e.note}</span>}
              </td>
              <td className={`whitespace-nowrap px-2 py-1 ${statusClass[e.displayStatus]}`}>
                {STATUS_TEXT[e.displayStatus]}
                {e.displayStatus === "released" && KIND_LINK[e.kind] && (
                  <Link href={KIND_LINK[e.kind]!} className="ml-1 text-xs underline">
                    看图表
                  </Link>
                )}
              </td>
              <td className="whitespace-nowrap px-2 py-1 text-xs">
                <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                  {e.origin === "manual" ? "人工录入" : "官方日程"}
                </a>
                {allowDelete && e.origin === "manual" && (
                  <form method="post" action="/api/events" className="inline">
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="key" value={e.key} />
                    <button type="submit" className="ml-2 text-[var(--muted)] underline">
                      删除
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
