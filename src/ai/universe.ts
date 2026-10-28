import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { companies, universeChanges, universeMembers } from "@/db/schema";
import { DEFAULT_UNIVERSE, LAYERS, type Cyclicality, type Layer } from "./companies";

export type Member = typeof universeMembers.$inferSelect;

export class UniverseError extends Error {}

// 首次运行时写入默认关注池；之后完全由用户编辑，不再覆盖
export async function ensureDefaultUniverse(db: Db, lookup: (symbol: string) => Promise<{ cik: string; name: string } | undefined>) {
  const existing = await db.select({ symbol: universeMembers.symbol }).from(universeMembers).limit(1);
  if (existing.length) return 0;
  for (const m of DEFAULT_UNIVERSE) {
    const info = await lookup(m.symbol);
    if (!info) throw new UniverseError(`SEC 登记中找不到默认成员 ${m.symbol}`);
    await db.insert(companies).values({ symbol: m.symbol, cik: info.cik, name: info.name, fiscalYearEndMonth: 0 }).onConflictDoNothing();
    await db.insert(universeMembers).values({ symbol: m.symbol, layer: m.layer, cyclicality: m.cyclicality, inHyperscalerCapex: m.inHyperscalerCapex ?? false });
  }
  await db.insert(universeChanges).values({ symbol: "*", action: "init", before: null, after: { count: DEFAULT_UNIVERSE.length } });
  return DEFAULT_UNIVERSE.length;
}

export async function activeMembers(db: Db) {
  return db
    .select({ symbol: universeMembers.symbol, layer: universeMembers.layer, cyclicality: universeMembers.cyclicality, inHyperscalerCapex: universeMembers.inHyperscalerCapex, cik: companies.cik, name: companies.name })
    .from(universeMembers)
    .innerJoin(companies, eq(companies.symbol, universeMembers.symbol))
    .where(eq(universeMembers.active, true))
    .orderBy(asc(universeMembers.symbol));
}

const validLayer = (l: string): l is Layer => LAYERS.some((x) => x.id === l);
const validCyc = (c: string): c is Cyclicality => ["strong", "medium", "growth"].includes(c);

// 新增或重新加入：必须能在 SEC 登记中找到；移除后再加入时沿用原有历史数据
export async function addMember(
  db: Db,
  input: { symbol: string; layer: string; cyclicality: string; inHyperscalerCapex: boolean },
  lookup: (symbol: string) => Promise<{ cik: string; name: string } | undefined>,
  checkBudget: (symbolCount: number) => { ok: boolean; message: string },
) {
  const symbol = input.symbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z.\-]{0,9}$/.test(symbol)) throw new UniverseError("代码格式不正确");
  if (!validLayer(input.layer) || !validCyc(input.cyclicality)) throw new UniverseError("请选择层与周期分类");
  const [current] = await db.select().from(universeMembers).where(eq(universeMembers.symbol, symbol));
  if (current?.active) throw new UniverseError(`${symbol} 已在关注池中`);
  const info = await lookup(symbol);
  if (!info) throw new UniverseError(`在 SEC 登记中找不到 ${symbol}，无法取得财报数据`);
  const count = (await activeMembers(db)).length + 1;
  const budget = checkBudget(count);
  if (!budget.ok) throw new UniverseError(budget.message);

  await db.insert(companies).values({ symbol, cik: info.cik, name: info.name, fiscalYearEndMonth: 0 }).onConflictDoUpdate({ target: companies.symbol, set: { cik: info.cik, name: info.name } });
  const row = { symbol, layer: input.layer, cyclicality: input.cyclicality, inHyperscalerCapex: input.inHyperscalerCapex, active: true };
  await db.insert(universeMembers).values(row).onConflictDoUpdate({ target: universeMembers.symbol, set: row });
  await db.insert(universeChanges).values({ symbol, action: current ? "readd" : "add", before: current ?? null, after: row });
  return { symbol, name: info.name };
}

export async function removeMember(db: Db, symbol: string) {
  const [current] = await db.select().from(universeMembers).where(eq(universeMembers.symbol, symbol));
  if (!current?.active) throw new UniverseError(`${symbol} 不在关注池中`);
  await db.update(universeMembers).set({ active: false }).where(eq(universeMembers.symbol, symbol));
  await db.insert(universeChanges).values({ symbol, action: "remove", before: current, after: { ...current, active: false } });
}

export async function updateMember(db: Db, symbol: string, patch: { layer?: string; cyclicality?: string; inHyperscalerCapex?: boolean }) {
  const [current] = await db.select().from(universeMembers).where(eq(universeMembers.symbol, symbol));
  if (!current?.active) throw new UniverseError(`${symbol} 不在关注池中`);
  if (patch.layer !== undefined && !validLayer(patch.layer)) throw new UniverseError("层无效");
  if (patch.cyclicality !== undefined && !validCyc(patch.cyclicality)) throw new UniverseError("周期分类无效");
  const next = { ...current, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
  await db.update(universeMembers).set({ layer: next.layer, cyclicality: next.cyclicality, inHyperscalerCapex: next.inHyperscalerCapex }).where(eq(universeMembers.symbol, symbol));
  await db.insert(universeChanges).values({ symbol, action: "update", before: current, after: next });
}

export async function universeHistory(db: Db, limit = 50) {
  return db.select().from(universeChanges).orderBy(desc(universeChanges.id)).limit(limit);
}
