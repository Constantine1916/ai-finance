import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

export function testDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("缺少 TEST_DATABASE_URL，global-setup 未运行");
  const pool = new Pool({ connectionString: url, max: 2 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

// 清理某个代码的价格相关数据，避免不同测试文件共用 SPY 等代码时互相影响
export async function clearSymbol(db: ReturnType<typeof testDb>["db"], symbol: string) {
  const { derivedValues, intradaySnapshots, observations } = await import("@/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  await db.delete(intradaySnapshots).where(eq(intradaySnapshots.symbol, symbol));
  await db.delete(observations).where(inArray(observations.seriesId, [`tiingo:${symbol}:close`, `tiingo:${symbol}:div`, `tiingo:${symbol}:split`]));
  await db.delete(derivedValues).where(inArray(derivedValues.derivedId, [`adj:${symbol}`, `sma200:${symbol}`, `dd52w:${symbol}`]));
}
