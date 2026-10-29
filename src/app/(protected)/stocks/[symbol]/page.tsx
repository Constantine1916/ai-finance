import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { filings } from "@/db/schema";
import { ChartCard } from "@/components/ChartCard";
import TradingViewChart from "@/components/TradingViewChart";
import { CYCLICALITY_NAME, LAYERS, type Cyclicality } from "@/ai/companies";
import { stockInfo } from "@/ai/stock";
import { secLookup } from "@/jobs/registry";
import { requireOwner } from "@/lib/auth/guard";
import { lineSourceIds, sourceMeta } from "@/macro/build";
import { stockChartSpec, type StockChartKind } from "@/macro/charts";
import { priceStats } from "@/macro/market";

export const dynamic = "force-dynamic";

const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
const EXCHANGE: Record<string, string> = { Nasdaq: "NASDAQ", NYSE: "NYSE", "NYSE American": "AMEX", "NYSE Arca": "AMEX", CBOE: "CBOE" };

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  await requireOwner();
  const { symbol } = await params;
  const db = getDb();
  const info = await stockInfo(db, decodeURIComponent(symbol));
  // 不在关注池中的代码：只显示未收录，不向任何供应商请求
  if (!info) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">未收录</h1>
        <p className="mt-2 text-[var(--muted)]">“{decodeURIComponent(symbol).slice(0, 12)}”不在关注池中。可以在 AI 产业页的关注池中加入。</p>
        <Link href="/ai#universe" className="mt-3 inline-block underline">
          前往关注池
        </Link>
      </main>
    );
  }

  const now = new Date();
  const annual = info.mode === "annual";
  const kinds: StockChartKind[] = annual ? ["price", "revenue", "margins", "inventory", "capex"] : ["price", "revenue", "margins", "inventory", "capex", "pe", "pb"];
  const specs = kinds.map((k) => stockChartSpec(info.symbol, k, annual, info.currency));
  const [price, recent, metas, directory] = await Promise.all([
    priceStats(db, info.symbol, now),
    db.select().from(filings).where(eq(filings.cik, info.cik)).orderBy(desc(filings.filedAt)).limit(40),
    sourceMeta(db, [...new Set(specs.flatMap((s) => s.lines.flatMap(lineSourceIds)))], now),
    secLookup(info.symbol).catch(() => undefined),
  ]);
  const periodic = recent.filter((f) => ["10-Q", "10-K", "20-F", "10-Q/A", "10-K/A", "20-F/A"].includes(f.form)).slice(0, 8);
  const tvSymbol = `${EXCHANGE[directory?.exchange ?? ""] ?? "NASDAQ"}:${info.symbol}`;
  const layer = LAYERS.find((l) => l.id === info.layer)?.name ?? info.layer;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/ai#universe" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
        ← 关注池
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">
        {info.symbol} <span className="text-base font-normal text-[var(--muted)]">{info.name}</span>
      </h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {layer} · {CYCLICALITY_NAME[info.cyclicality as Cyclicality]}
        {info.inHyperscalerCapex && " · 计入云厂商资本开支合计"} · 财报口径：{annual ? `年度（20-F，${info.currency}）` : info.mode === "quarterly" ? `季度（${info.currency}）` : "采集中"}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["最新价", price.price === null ? "—" : price.price.toFixed(2), price.view.kind === "provisional" ? "盘中暂定" : price.view.kind === "official" ? `收盘 ${price.view.obsDate}` : "采集中"],
          ["1 个月", pct(price.r1m), ""],
          ["3 个月", pct(price.r3m), ""],
          ["年初至今", pct(price.ytd), ""],
          ["距 200 日线", pct(price.vs200), ""],
          ["距 52 周高点", pct(price.dd52w), ""],
        ].map(([k, v, note]) => (
          <div key={k} className="rounded border border-[var(--border)] bg-[var(--panel)] p-2">
            <dt className="text-xs text-[var(--muted)]">{k}</dt>
            <dd className="num text-lg">{v}</dd>
            {note && <dd className="text-xs text-[var(--muted)]">{note}</dd>}
          </div>
        ))}
      </dl>

      <section className="mt-6">
        <TradingViewChart tvSymbol={tvSymbol} />
      </section>

      {annual && <p className="mt-6 text-sm text-[var(--muted)]">外国申报公司只提交年度 20-F，以 {info.currency} 计价；估值涉及 ADR 换股比例与汇率，本系统不计算市盈率与市净率。</p>}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {specs.map((spec) => (
          <ChartCard key={spec.id} spec={spec} sources={[...new Set(spec.lines.flatMap(lineSourceIds))].map((id) => metas.find((m) => m.id === id)!).filter(Boolean)} now={now} />
        ))}
      </section>

      <section className="mt-6 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
        <h2 className="font-medium">最近的定期申报</h2>
        {periodic.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">尚未记录申报。</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {periodic.map((f) => (
              <li key={f.accessionNo}>
                <a href={f.url} target="_blank" rel="noreferrer" className="underline">
                  {f.form}
                </a>{" "}
                <span className="num text-[var(--muted)]">
                  报告期 {f.periodEnd ?? "—"} · 提交 {f.filedAt}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
