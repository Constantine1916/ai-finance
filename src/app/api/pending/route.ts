import { getDb } from "@/db/client";
import { withOwner } from "@/lib/auth/guard";
import { isSameOrigin } from "@/lib/auth/same-origin";
import { backWith } from "@/lib/http";
import { confirmPending, discardPending } from "@/pipeline/store";

export const dynamic = "force-dynamic";

export const POST = withOwner(async (request: Request) => {
  if (!isSameOrigin(request.headers)) return Response.json({ error: "跨站请求被拒绝" }, { status: 403 });
  const form = await request.formData();
  const seriesId = String(form.get("seriesId") ?? "");
  const obsDate = String(form.get("obsDate") ?? "");
  const action = String(form.get("action") ?? "");
  try {
    const db = getDb();
    const ok = action === "confirm" ? await confirmPending(db, seriesId, obsDate) : action === "discard" ? await discardPending(db, seriesId, obsDate) : false;
    return backWith("/data", ok ? { msg: action === "confirm" ? "已确认" : "已删除" } : { error: "待确认记录不存在" });
  } catch (error) {
    console.error("处理待确认观测失败", error instanceof Error ? error.message : error);
    return backWith("/data", { error: "操作失败，请重试" });
  }
});
