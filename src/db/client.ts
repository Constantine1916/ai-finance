import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getConfig } from "@/lib/config";
import * as schema from "./schema";

let pool: Pool | undefined;

export function getDb() {
  pool ??= new Pool({ connectionString: getConfig().databaseUrl, max: 5 });
  return drizzle(pool, { schema });
}

export async function closeDb() {
  await pool?.end();
  pool = undefined;
}
