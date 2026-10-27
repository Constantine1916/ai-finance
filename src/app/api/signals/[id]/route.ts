import { getDb } from "@/db/client";
import { withOwner } from "@/lib/auth/guard";
import { isSameOrigin } from "@/lib/auth/same-origin";
import { backWith } from "@/lib/http";
import { ParamError, saveParams } from "@/signals/engine";
import { defaultParams, RULE_MAP } from "@/signals/rules";

export const dynamic = "force-dynamic";

// 修改或恢复某条规则的阈值；每次修改都新增一条记录，不覆盖历史
export const POST = withOwner(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  if (!isSameOrigin(request.headers)) return Response.json({ error: "跨站请求被拒绝" }, { status: 403 });
  const { id } = await context.params;
  const rule = RULE_MAP.get(id);
  if (!rule) return Response.json({ error: "未知规则" }, { status: 404 });
  const form = await request.formData();
  const raw =
    form.get("action") === "reset"
      ? Object.fromEntries(Object.entries(defaultParams(rule)).map(([k, v]) => [k, String(v)]))
      : Object.fromEntries(Object.keys(rule.params).map((k) => [k, String(form.get(k) ?? "")]));
  try {
    await saveParams(getDb(), id, raw);
    return backWith(`/signals/${id}`, { msg: form.get("action") === "reset" ? "已恢复默认阈值" : "阈值已保存，状态与历史表现已按新阈值重新计算" });
  } catch (error) {
    if (error instanceof ParamError) return backWith(`/signals/${id}`, { error: error.message });
    console.error("保存阈值失败", error instanceof Error ? error.message : error);
    return backWith(`/signals/${id}`, { error: "保存失败，请重试" });
  }
});
