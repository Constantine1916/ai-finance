import Link from "next/link";
import { getDb } from "@/db/client";
import { ChartCard } from "@/components/ChartCard";
import { isBackfilling } from "@/ai/backfill";
import { CYCLICALITY_NAME, LAYERS, type Cyclicality } from "@/ai/companies";
import { aggregateByCalendarQuarter } from "@/ai/metrics";
import { cyclicalView, universeTable } from "@/ai/table";
import { activeMembers, universeHistory } from "@/ai/universe";
import { edgarSeriesId } from "@/jobs/edgar";
import { requireOwner } from "@/lib/auth/guard";
import { lineSourceIds, sourceMeta, type SourceMeta } from "@/macro/build";
import { AI_CHARTS, type ChartSpec } from "@/macro/charts";
import { readSeries } from "@/pipeline/store";

export const dynamic = "force-dynamic";

const pct = (v: number | null, digits = 1) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`);
const tone = (v: number | null) => (v === null ? "text-[var(--muted)]" : v >= 0 ? "text-[var(--up)]" : "text-[var(--down)]");
const fmt = (d: Date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "short" }).format(d);
const etTime = (d: Date) => new Intl.DateTimeFormat("zh-CN", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const input = "rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1";
const th = "px-2 py-1 font-normal text-[var(--muted)]";

function ratioCell(v: { value: number | null; status: string } | null, annual: boolean, filling: boolean) {
  if (annual) return <span className="text-xs text-[var(--muted)]">外国申报，不计算</span>;
  if (!v) return <span className="text-xs text-[var(--muted)]">{filling ? "采集中" : "—"}</span>;
  if (v.value !== null) return v.value.toFixed(1);
  const reason = v.status === "loss" ? "亏损，不适用" : v.status === "negative" ? "权益为负" : "数据不足";
  return <span className="text-xs text-[var(--muted)]">{reason}</span>;
}

export default async function AiPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requireOwner();
  const { msg, error } = await searchParams;
  const db = getDb();
  const now = new Date();
  const [rows, history, members] = await Promise.all([universeTable(db, now), universeHistory(db, 30), activeMembers(db)]);
  const hyperscalers = members.filter((m) => m.inHyperscalerCapex);
  const capex = aggregateByCalendarQuarter(Object.fromEntries(await Promise.all(hyperscalers.map(async (m) => [m.symbol, await readSeries(db, edgarSeriesId(m.symbol, "capex"))] as const))));
  const pendingQuarter = capex.at(-1)?.total === null ? capex.at(-1) : null;
  const cyclicals = await Promise.all(rows.filter((r) => r.cyclicality === "strong" && !r.annual).map((r) => cyclicalView(db, r.symbol)));
  const ids = [...new Set(AI_CHARTS.flatMap((c) => c.lines.flatMap(lineSourceIds)))];
  const metas = await sourceMeta(db, ids, now);
  const metaFor = (spec: ChartSpec) => [...new Set(spec.lines.flatMap(lineSourceIds))].map((id) => metas.find((m) => m.id === id)).filter((m): m is SourceMeta => Boolean(m));
  const chart = (id: string) => {
    const spec = AI_CHARTS.find((c) => c.id === id)!;
    return <ChartCard key={id} spec={spec} sources={metaFor(spec)} now={now} />;
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold">AI 产业周期</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">需求端看云厂商资本开支与云收入，供给端看台积电与半导体工业产出，个股看营收增速、毛利率与存货。分层与周期分类是人工标签，不是指数成分或投资建议。</p>
      {msg && <p className="mt-2 text-sm text-[var(--up)]">{msg}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--down)]">
          {error}
        </p>
      )}
      <nav className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
        {[["demand", "需求端"], ["supply", "供给与领先指标"], ["universe", "关注池"], ["cyclical", "周期股视图"]].map(([id, name]) => (
          <a key={id} href={`#${id}`} className="hover:text-[var(--text)]">
            {name}
          </a>
        ))}
      </nav>

      <section id="demand" className="mt-8 scroll-mt-4">
        <h2 className="text-lg font-semibold">需求端</h2>
        {pendingQuarter && (
          <p className="mt-2 text-sm text-[var(--muted)]">
            {pendingQuarter.cq} 尚不完整，未计入合计：已申报 {Object.keys(pendingQuarter.byCompany).join("、") || "无"}；尚缺 {pendingQuarter.missing.join("、")}。
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">{["ai-capex", "ai-capex-yoy", "ai-cloud-growth"].map(chart)}</div>
      </section>

      <section id="supply" className="mt-10 scroll-mt-4">
        <h2 className="text-lg font-semibold">供给与领先指标</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">{["ai-tsmc", "ai-tsmc-yoy", "ai-semis-ip"].map(chart)}</div>
      </section>

      <section id="universe" className="mt-10 scroll-mt-4">
        <h2 className="text-lg font-semibold">关注池（{rows.length}）</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">相对强弱为近 3 个月涨跌减去 SOXX 或 SPY 同期涨跌（百分点）。营收同比与毛利率为最新一期财报；交易时段内最新价为盘中暂定价。</p>
        {LAYERS.map((layer) => {
          const inLayer = rows.filter((r) => r.layer === layer.id);
          if (inLayer.length === 0) return null;
          return (
            <div key={layer.id} className="mt-4 overflow-x-auto rounded border border-[var(--border)] bg-[var(--panel)] p-3">
              <h3 className="font-medium">{layer.name}</h3>
              <table className="mt-2 w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="text-xs">
                    <th className={`${th} text-left`}>代码</th>
                    <th className={`${th} text-right`}>最新价</th>
                    <th className={`${th} text-right`}>1 个月</th>
                    <th className={`${th} text-right`}>3 个月</th>
                    <th className={`${th} text-right`}>年初至今</th>
                    <th className={`${th} text-right`}>相对 SOXX</th>
                    <th className={`${th} text-right`}>相对 SPY</th>
                    <th className={`${th} text-right`}>距 200 日线</th>
                    <th className={`${th} text-right`}>营收同比</th>
                    <th className={`${th} text-right`}>毛利率</th>
                    <th className={`${th} text-right`}>市盈率</th>
                    <th className={`${th} text-right`}>市净率</th>
                    <th className={`${th} text-left`}>调整</th>
                  </tr>
                </thead>
                <tbody>
                  {inLayer.map((r) => {
                    const filling = isBackfilling(r.symbol) || r.price.view.kind === "none";
                    return (
                      <tr key={r.symbol} className="border-t border-[var(--border)] align-top">
                        <td className="px-2 py-1.5">
                          <Link href={`/stocks/${r.symbol}`} className="font-medium underline decoration-[var(--border)] underline-offset-4">
                            {r.symbol}
                          </Link>
                          <span className="block max-w-48 truncate text-xs text-[var(--muted)]">{r.name}</span>
                          <span className="block text-xs text-[var(--muted)]">
                            {CYCLICALITY_NAME[r.cyclicality as Cyclicality]}
                            {r.inHyperscalerCapex && " · 计入资本开支合计"}
                          </span>
                        </td>
                        <td className="num px-2 py-1.5 text-right">
                          {r.price.price === null ? <span className="text-xs text-[var(--muted)]">{filling ? "采集中" : "—"}</span> : r.price.price.toFixed(2)}
                          <span className="block whitespace-nowrap text-xs text-[var(--muted)]">
                            {r.price.view.kind === "provisional" ? `盘中 ${etTime(r.price.view.capturedAt)}` : r.price.view.kind === "official" ? `收盘 ${r.price.view.obsDate}` : ""}
                          </span>
                        </td>
                        {[r.price.r1m, r.price.r3m, r.price.ytd, r.rel3mSoxx, r.rel3mSpy, r.price.vs200].map((v, i) => (
                          <td key={i} className={`num px-2 py-1.5 text-right ${tone(v)}`}>
                            {pct(v)}
                          </td>
                        ))}
                        <td className={`num px-2 py-1.5 text-right ${tone(r.revenueYoY)}`}>
                          {pct(r.revenueYoY)}
                          <span className="block text-xs text-[var(--muted)]">{r.lastPeriod ? `${r.annual ? "年报" : "季报"} ${r.lastPeriod}` : filling ? "采集中" : ""}</span>
                        </td>
                        <td className="num px-2 py-1.5 text-right">{r.grossMargin === null ? <span className="text-xs text-[var(--muted)]">未申报</span> : `${r.grossMargin.toFixed(1)}%`}</td>
                        <td className="num px-2 py-1.5 text-right">{ratioCell(r.pe, r.annual, filling)}</td>
                        <td className="num px-2 py-1.5 text-right">{ratioCell(r.pb, r.annual, filling)}</td>
                        <td className="px-2 py-1.5">
                          <details>
                            <summary className="cursor-pointer text-xs text-[var(--muted)]">编辑</summary>
                            <form method="post" action="/api/universe" className="mt-1 grid gap-1 text-xs">
                              <input type="hidden" name="action" value="update" />
                              <input type="hidden" name="symbol" value={r.symbol} />
                              <select name="layer" defaultValue={r.layer} className={input}>
                                {LAYERS.map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.name}
                                  </option>
                                ))}
                              </select>
                              <select name="cyclicality" defaultValue={r.cyclicality} className={input}>
                                {Object.entries(CYCLICALITY_NAME).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                              <label className="flex items-center gap-1">
                                <input type="checkbox" name="inHyperscalerCapex" defaultChecked={r.inHyperscalerCapex} /> 计入资本开支合计
                              </label>
                              <button type="submit" className="rounded border border-[var(--border)] px-2 py-0.5">
                                保存
                              </button>
                            </form>
                            <form method="post" action="/api/universe" className="mt-1">
                              <input type="hidden" name="action" value="remove" />
                              <input type="hidden" name="symbol" value={r.symbol} />
                              <button type="submit" className="text-xs text-[var(--down)] underline">
                                移出关注池
                              </button>
                            </form>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        <div className="mt-4 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
          <h3 className="font-medium">加入证券</h3>
          <form method="post" action="/api/universe" className="mt-2 flex flex-wrap items-end gap-3 text-sm">
            <input type="hidden" name="action" value="add" />
            <label className="grid gap-1">
              代码
              <input name="symbol" required placeholder="INTC" className={`${input} w-24 uppercase`} />
            </label>
            <label className="grid gap-1">
              层
              <select name="layer" className={input}>
                {LAYERS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              周期分类
              <select name="cyclicality" className={input}>
                {Object.entries(CYCLICALITY_NAME).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 pb-1">
              <input type="checkbox" name="inHyperscalerCapex" /> 计入资本开支合计
            </label>
            <button type="submit" className="rounded bg-[var(--text)] px-3 py-1 text-[var(--bg)]">
              加入
            </button>
          </form>
          <p className="mt-2 text-xs text-[var(--muted)]">代码须能在 SEC 登记中找到；加入后在后台补齐历史价格与财报。盘中快照的请求量超过 Finnhub 额度的 80% 时会拒绝加入。</p>
          {history.length > 0 && (
            <details className="mt-3 text-xs text-[var(--muted)]">
              <summary>修改记录（{history.length}）</summary>
              <ul className="mt-1 space-y-0.5">
                {history.map((h) => (
                  <li key={h.id}>
                    {fmt(h.changedAt)} · {h.symbol === "*" ? "初始化默认关注池" : `${h.symbol} ${{ add: "加入", readd: "重新加入", remove: "移出", update: "调整" }[h.action] ?? h.action}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>

      <section id="cyclical" className="mt-10 scroll-mt-4">
        <h2 className="text-lg font-semibold">周期股视图</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          强周期股在盈利高峰时市盈率最低、看起来最便宜，往往正是周期顶部；亏损时市盈率最高或无法计算，反而常在底部。这里改看毛利率、存货天数与市净率在 2010 年以来历史中的位置。
        </p>
        <div className="mt-3 overflow-x-auto rounded border border-[var(--border)] bg-[var(--panel)] p-3">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-xs">
                <th className={`${th} text-left`}>代码</th>
                <th className={`${th} text-right`}>毛利率</th>
                <th className={`${th} text-right`}>历史区间</th>
                <th className={`${th} text-right`}>存货天数</th>
                <th className={`${th} text-right`}>历史区间</th>
                <th className={`${th} text-right`}>市净率</th>
                <th className={`${th} text-right`}>历史区间</th>
              </tr>
            </thead>
            <tbody>
              {cyclicals.map((c) => {
                const pos = (r: { percentile: number | null } | null) => (r?.percentile == null ? "" : `（第 ${r.percentile.toFixed(0)} 百分位）`);
                return (
                  <tr key={c.symbol} className="border-t border-[var(--border)]">
                    <td className="px-2 py-1">
                      <Link href={`/stocks/${c.symbol}`} className="underline decoration-[var(--border)] underline-offset-4">
                        {c.symbol}
                      </Link>
                    </td>
                    <td className="num px-2 py-1 text-right">{c.margin.current?.value == null ? "—" : `${c.margin.current.value.toFixed(1)}%`}</td>
                    <td className="num px-2 py-1 text-right text-xs text-[var(--muted)]">{c.margin.range ? `${c.margin.range.min.toFixed(0)}～${c.margin.range.max.toFixed(0)}%${pos(c.margin.range)}` : "—"}</td>
                    <td className="num px-2 py-1 text-right">{c.inventoryDays.current?.value == null ? "—" : c.inventoryDays.current.value.toFixed(0)}</td>
                    <td className="num px-2 py-1 text-right text-xs text-[var(--muted)]">{c.inventoryDays.range ? `${c.inventoryDays.range.min.toFixed(0)}～${c.inventoryDays.range.max.toFixed(0)}${pos(c.inventoryDays.range)}` : "—"}</td>
                    <td className="num px-2 py-1 text-right">{c.pb.current?.value == null ? "—" : c.pb.current.value.toFixed(2)}</td>
                    <td className="num px-2 py-1 text-right text-xs text-[var(--muted)]">{c.pb.range ? `${c.pb.range.min.toFixed(1)}～${c.pb.range.max.toFixed(1)}${pos(c.pb.range)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-[var(--muted)]">只列出分类为“强周期”且按季申报的成员；分类可在关注池中调整。</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">{["ai-mu-capex-guide"].map(chart)}</div>
      </section>
    </main>
  );
}
