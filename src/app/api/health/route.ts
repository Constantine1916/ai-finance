// 健康检查：只返回存活状态，不返回序列、数值或任务细节。
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
