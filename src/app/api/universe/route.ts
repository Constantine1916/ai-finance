import { getDb } from "@/db/client";
import { startBackfill } from "@/ai/backfill";
import { runDerive } from "@/jobs/derive";
import { addMember, removeMember, UniverseError, updateMember } from "@/ai/universe";
import { checkUniverseBudget, secLookup } from "@/jobs/registry";
import { withOwner } from "@/lib/auth/guard";
import { isSameOrigin } from "@/lib/auth/same-origin";
import { backWith } from "@/lib/http";

export const dynamic = "force-dynamic";

// 关注池编辑：新增（SEC 登记中可查且不超出盘中请求预算）、移除（保留历史）、调整分类与汇总成员
export const POST = withOwner(async (request: Request) => {
  if (!isSameOrigin(request.headers)) return Response.json({ error: "跨站请求被拒绝" }, { status: 403 });
  const form = await request.formData();
  const field = (k: string) => String(form.get(k) ?? "");
  const db = getDb();
  try {
    switch (field("action")) {
      case "add": {
        const r = await addMember(db, { symbol: field("symbol"), layer: field("layer"), cyclicality: field("cyclicality"), inHyperscalerCapex: form.get("inHyperscalerCapex") === "on" }, secLookup, checkUniverseBudget);
        const info = await secLookup(r.symbol);
        if (info) startBackfill(db, r.symbol, info.cik);
        return backWith("/ai", { msg: `已加入 ${r.symbol}（${r.name}），正在补齐历史价格与财报` });
      }
      case "remove":
        await removeMember(db, field("symbol"));
        return backWith("/ai", { msg: `已移除 ${field("symbol")}，历史数据保留，重新加入后可继续使用` });
      case "update":
        await updateMember(db, field("symbol"), { layer: field("layer"), cyclicality: field("cyclicality"), inHyperscalerCapex: form.get("inHyperscalerCapex") === "on" });
        void runDerive(db).catch((e) => console.error("重算派生指标失败", e instanceof Error ? e.message : e));
        return backWith("/ai", { msg: `已更新 ${field("symbol")}，正在按新分类与汇总成员重算（约 1 分钟）` });
      default:
        return backWith("/ai", { error: "未知操作" });
    }
  } catch (error) {
    if (error instanceof UniverseError) return backWith("/ai", { error: error.message });
    console.error("关注池修改失败", error instanceof Error ? error.message : error);
    return backWith("/ai", { error: "操作失败，请重试" });
  }
});
