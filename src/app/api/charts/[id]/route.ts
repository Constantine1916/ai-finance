import { getDb } from "@/db/client";
import { stockInfo } from "@/ai/stock";
import { withOwner } from "@/lib/auth/guard";
import { buildChart } from "@/macro/build";
import { CHARTS, RANGES, STOCK_CHART_KINDS, stockChartSpec, type ChartSpec, type Range, type StockChartKind } from "@/macro/charts";

export const dynamic = "force-dynamic";

async function resolve(id: string): Promise<ChartSpec | null> {
  const fixed = CHARTS.get(id);
  if (fixed) return fixed;
  const [prefix, symbol, kind] = id.split(":");
  if (prefix !== "stock" || !symbol || !STOCK_CHART_KINDS.includes(kind as StockChartKind)) return null;
  const info = await stockInfo(getDb(), symbol);
  if (!info) return null;
  return stockChartSpec(info.symbol, kind as StockChartKind, info.mode === "annual", info.currency);
}

export const GET = withOwner(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const spec = await resolve(decodeURIComponent(id));
  if (!spec) return Response.json({ error: "未知图表或未收录的证券" }, { status: 404 });
  const range = new URL(request.url).searchParams.get("range") ?? spec.defaultRange ?? "5y";
  if (!RANGES.includes(range as Range)) return Response.json({ error: "不支持的区间" }, { status: 400 });
  try {
    const data = await buildChart(getDb(), spec, range as Range);
    return Response.json(data, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    console.error(`图表 ${id} 构建失败`, error instanceof Error ? error.message : error);
    return Response.json({ error: "数据暂不可用" }, { status: 503 });
  }
});
