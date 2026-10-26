import { getDb } from "@/db/client";
import { withOwner } from "@/lib/auth/guard";
import { isSameOrigin } from "@/lib/auth/same-origin";
import { backWith } from "@/lib/http";
import { ManualEntryError, saveManualEntry } from "@/pipeline/manual";

export const dynamic = "force-dynamic";

export const POST = withOwner(async (request: Request) => {
  if (!isSameOrigin(request.headers)) return Response.json({ error: "跨站请求被拒绝" }, { status: 403 });
  const form = await request.formData();
  const field = (k: string) => String(form.get(k) ?? "");
  try {
    const { write } = await saveManualEntry(getDb(), {
      seriesId: field("seriesId"),
      obsDate: field("obsDate"),
      value: field("value"),
      unit: field("unit"),
      sourceUrl: field("sourceUrl"),
      note: field("note") || undefined,
    });
    const msg = write.pending ? "已保存，但未通过校验，已列入待确认" : "已保存";
    return backWith("/data", { msg });
  } catch (error) {
    if (error instanceof ManualEntryError) return backWith("/data", { error: error.message });
    console.error("人工录入失败", error instanceof Error ? error.message : error);
    return backWith("/data", { error: "保存失败，请重试" });
  }
});
