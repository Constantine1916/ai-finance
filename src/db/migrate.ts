import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "./client";

await migrate(getDb(), { migrationsFolder: "drizzle" });
await closeDb();
console.log("数据库迁移完成");
