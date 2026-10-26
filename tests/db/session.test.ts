import { afterAll, describe, expect, it } from "vitest";
import { sessions } from "@/db/schema";
import { createSession, hashToken, isSessionValid, revokeSession, SESSION_TTL_MS } from "@/lib/auth/session";
import { testDb } from "./helpers";

const secret = "s".repeat(64);
const { db, close } = testDb();
afterAll(close);

describe("sessions", () => {
  it("accepts a fresh session and stores only the token HMAC", async () => {
    const { token } = await createSession(db, secret);
    expect(await isSessionValid(db, secret, token)).toBe(true);
    const stored = await db.select().from(sessions);
    expect(stored.some((s) => s.tokenHash === token)).toBe(false);
    expect(stored.some((s) => s.tokenHash === hashToken(token, secret))).toBe(true);
  });

  it("rejects the old cookie after sign out", async () => {
    const { token } = await createSession(db, secret);
    await revokeSession(db, secret, token);
    expect(await isSessionValid(db, secret, token)).toBe(false);
  });

  it("rejects expired, unknown, missing and differently signed tokens", async () => {
    const past = new Date(Date.now() - SESSION_TTL_MS - 1000);
    const { token: expired } = await createSession(db, secret, past);
    expect(await isSessionValid(db, secret, expired)).toBe(false);
    expect(await isSessionValid(db, secret, "not-a-real-token")).toBe(false);
    expect(await isSessionValid(db, secret, undefined)).toBe(false);
    const { token } = await createSession(db, secret);
    expect(await isSessionValid(db, "x".repeat(64), token)).toBe(false);
  });
});
