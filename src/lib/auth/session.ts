import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { sessions } from "@/db/schema";

export const SESSION_COOKIE = "af_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Db = NodePgDatabase<typeof schema>;

// 数据库只保存令牌的 HMAC，泄露会话表也无法还原 Cookie
export function hashToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export async function createSession(db: Db, secret: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ tokenHash: hashToken(token, secret), createdAt: now, expiresAt });
  return { token, expiresAt };
}

export async function isSessionValid(db: Db, secret: string, token: string | undefined, now = new Date()) {
  if (!token) return false;
  const rows = await db
    .select({ tokenHash: sessions.tokenHash })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token, secret)), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
    .limit(1);
  return rows.length === 1;
}

export async function revokeSession(db: Db, secret: string, token: string | undefined, now = new Date()) {
  if (!token) return;
  await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.tokenHash, hashToken(token, secret)));
}
