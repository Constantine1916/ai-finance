import { and, count, eq, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { loginAttempts } from "@/db/schema";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;

type Db = NodePgDatabase<typeof schema>;

// 记录存在 PostgreSQL，多个进程共享同一份限流状态
export async function isLoginBlocked(db: Db, sourceKey: string, now = new Date()) {
  const [row] = await db
    .select({ failures: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.sourceKey, sourceKey),
        eq(loginAttempts.success, false),
        gt(loginAttempts.attemptedAt, new Date(now.getTime() - LOGIN_WINDOW_MS)),
      ),
    );
  return (row?.failures ?? 0) >= LOGIN_MAX_FAILURES;
}

export async function recordLoginAttempt(db: Db, sourceKey: string, success: boolean, now = new Date()) {
  await db.insert(loginAttempts).values({ sourceKey, success, attemptedAt: now });
}
