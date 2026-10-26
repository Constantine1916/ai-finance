import { hash } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";
import { clientKey } from "@/lib/auth/client-key";
import { checkCredentials } from "@/lib/auth/credentials";
import { isPublicPath } from "@/lib/auth/public-paths";
import { isSameOrigin } from "@/lib/auth/same-origin";

describe("clientKey", () => {
  const forged = new Headers({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "203.0.113.9" });

  it("ignores forwarded headers when no trusted proxy is configured", () => {
    expect(clientKey(forged, false)).toBe("direct");
  });

  it("uses the proxy-provided address only when trusted", () => {
    expect(clientKey(forged, true)).toBe("ip:203.0.113.9");
    expect(clientKey(new Headers(), true)).toBe("proxy:unknown");
  });
});

describe("checkCredentials", async () => {
  const owner = { username: "constantine", passwordHash: await hash("correct horse") };

  it("accepts only the configured username and password", async () => {
    expect(await checkCredentials({ username: "constantine", password: "correct horse" }, owner)).toBe(true);
    expect(await checkCredentials({ username: "constantine", password: "wrong" }, owner)).toBe(false);
    expect(await checkCredentials({ username: "someone", password: "correct horse" }, owner)).toBe(false);
    expect(await checkCredentials({ username: "", password: "" }, owner)).toBe(false);
  });

  it("fails closed on a malformed stored hash", async () => {
    expect(await checkCredentials({ username: "constantine", password: "x" }, { username: "constantine", passwordHash: "bad" })).toBe(false);
  });
});

describe("isSameOrigin", () => {
  it("requires Origin to match the host", () => {
    expect(isSameOrigin(new Headers({ origin: "https://finance.aicave.cn", host: "finance.aicave.cn" }))).toBe(true);
    expect(isSameOrigin(new Headers({ origin: "https://evil.example", host: "finance.aicave.cn" }))).toBe(false);
    expect(isSameOrigin(new Headers({ host: "finance.aicave.cn" }))).toBe(false);
  });
});

describe("public paths", () => {
  it("only exposes login and the health check", () => {
    for (const p of ["/login", "/api/auth/login", "/api/auth/logout", "/api/health"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/", "/macro", "/data", "/api/series", "/register", "/sign-up", "/login/x"]) expect(isPublicPath(p)).toBe(false);
  });
});
