import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/types";
import { companies, series, universeMembers } from "@/db/schema";

// 个股基本信息：只对关注池中的有效成员返回，其他代码一律视为未收录（不向任何供应商请求）
export async function stockInfo(db: Db, rawSymbol: string) {
  const symbol = rawSymbol.toUpperCase();
  if (!/^[A-Z][A-Z.\-]{0,9}$/.test(symbol)) return null;
  const [row] = await db
    .select({ symbol: universeMembers.symbol, layer: universeMembers.layer, cyclicality: universeMembers.cyclicality, inHyperscalerCapex: universeMembers.inHyperscalerCapex, cik: companies.cik, name: companies.name })
    .from(universeMembers)
    .innerJoin(companies, eq(companies.symbol, universeMembers.symbol))
    .where(and(eq(universeMembers.symbol, symbol), eq(universeMembers.active, true)));
  if (!row) return null;
  const defs = await db.select({ id: series.id, unit: series.unit }).from(series).where(inArray(series.id, [`edgar:${symbol}:revenue`, `edgar:${symbol}:revenue:fy`]));
  const quarterly = defs.find((d) => d.id === `edgar:${symbol}:revenue`);
  const annual = defs.find((d) => d.id.endsWith(":fy"));
  const mode: "quarterly" | "annual" | "pending" = quarterly ? "quarterly" : annual ? "annual" : "pending";
  return { ...row, mode, currency: (quarterly ?? annual)?.unit ?? "USD" };
}
