import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

export function testDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("缺少 TEST_DATABASE_URL，global-setup 未运行");
  const pool = new Pool({ connectionString: url, max: 2 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
