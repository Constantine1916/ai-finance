import { afterAll, describe, expect, it } from "vitest";
import { isLoginBlocked, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { testDb } from "./helpers";

const { db, close } = testDb();
afterAll(close);

describe("login rate limit", () => {
  it("blocks after the configured number of failures within the window", async () => {
    const key = "ip:198.51.100.1";
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) await recordLoginAttempt(db, key, false);
    expect(await isLoginBlocked(db, key)).toBe(false);
    await recordLoginAttempt(db, key, false);
    expect(await isLoginBlocked(db, key)).toBe(true);
  });

  it("does not count successful attempts or other sources", async () => {
    const key = "ip:198.51.100.2";
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) await recordLoginAttempt(db, key, true);
    expect(await isLoginBlocked(db, key)).toBe(false);
    expect(await isLoginBlocked(db, "ip:198.51.100.3")).toBe(false);
  });

  it("releases the block once failures fall outside the window", async () => {
    const key = "ip:198.51.100.4";
    const old = new Date(Date.now() - LOGIN_WINDOW_MS - 1000);
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) await recordLoginAttempt(db, key, false, old);
    expect(await isLoginBlocked(db, key)).toBe(false);
  });
});
