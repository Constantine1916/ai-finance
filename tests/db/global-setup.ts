import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";

// 集成测试使用真实 PostgreSQL 中独立的 ai_finance_test 库，每次运行前重建
export async function setup() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("数据库集成测试需要 DATABASE_URL（先运行 npm run db:up）");
  const testUrl = new URL(base);
  testUrl.pathname = "/ai_finance_test";

  const admin = new Client({ connectionString: base });
  await admin.connect();
  await admin.query("DROP DATABASE IF EXISTS ai_finance_test WITH (FORCE)");
  await admin.query("CREATE DATABASE ai_finance_test");
  await admin.end();

  const pool = new Pool({ connectionString: testUrl.toString() });
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  await pool.end();
  process.env.TEST_DATABASE_URL = testUrl.toString();
}
