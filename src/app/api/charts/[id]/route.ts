import { getDb } from "@/db/client";
import { withOwner } from "@/lib/auth/guard";
import { buildChart } from "@/macro/build";
import { CHARTS, RANGES, type Range } from "@/macro/charts";

export const dynamic = "force-dynamic";

export const GET = withOwner(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const spec = CHARTS.get(id);
  if (!spec) return Response.json({ error: "未知图表" }, { status: 404 });
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
