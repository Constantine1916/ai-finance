import { getDb } from "@/db/client";
import { withOwner } from "@/lib/auth/guard";
import { isSameOrigin } from "@/lib/auth/same-origin";
import { backWith } from "@/lib/http";
import { deleteManualEvent, EventError, saveEarnings } from "@/calendar/importer";

export const dynamic = "force-dynamic";

// 人工维护的财报日期：新增（来源必填）或删除；官方日程不能在这里删除
export const POST = withOwner(async (request: Request) => {
  if (!isSameOrigin(request.headers)) return Response.json({ error: "跨站请求被拒绝" }, { status: 403 });
  const form = await request.formData();
  const field = (k: string) => String(form.get(k) ?? "");
  try {
    if (field("action") === "delete") {
      const ok = await deleteManualEvent(getDb(), field("key"));
      return backWith("/calendar", ok ? { msg: "已删除" } : { error: "只能删除人工录入的事件" });
    }
    await saveEarnings(getDb(), {
      symbol: field("symbol"),
      date: field("date"),
      timing: field("timing") as "bmo",
      time: field("time") || undefined,
      sourceUrl: field("sourceUrl"),
      confirmed: form.get("confirmed") === "on",
    });
    return backWith("/calendar", { msg: "已保存" });
  } catch (error) {
    if (error instanceof EventError) return backWith("/calendar", { error: error.message });
    console.error("保存事件失败", error instanceof Error ? error.message : error);
    return backWith("/calendar", { error: "保存失败，请重试" });
  }
});
