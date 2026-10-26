import { describe, expect, it } from "vitest";
import { ConfigError, parseConfig } from "@/lib/config";

const base = {
  DATABASE_URL: "postgres://u:db-password-value@127.0.0.1:5434/ai_finance",
};

const owner = {
  OWNER_USERNAME: "owner",
  OWNER_PASSWORD_HASH: "$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA",
  SESSION_SECRET: "s".repeat(64),
};

describe("parseConfig", () => {
  it("rejects a missing database url", () => {
    expect(() => parseConfig({})).toThrow(ConfigError);
  });

  it("keeps protected features off when owner credentials are missing", () => {
    const config = parseConfig({ ...base, OWNER_USERNAME: "owner" });
    expect(config.auth).toEqual({ configured: false, missing: ["OWNER_PASSWORD_HASH", "SESSION_SECRET"] });
  });

  it("enables auth only when every owner setting is present", () => {
    expect(parseConfig({ ...base, ...owner }).auth.configured).toBe(true);
  });

  it("rejects a password hash that is not Argon2id", () => {
    expect(() => parseConfig({ ...base, ...owner, OWNER_PASSWORD_HASH: "plain-text" })).toThrow(/Argon2id/);
  });

  it("rejects a short session secret", () => {
    expect(() => parseConfig({ ...base, ...owner, SESSION_SECRET: "short" })).toThrow(/32/);
  });

  it("marks providers without keys as unconfigured, treating blanks as missing", () => {
    const config = parseConfig({ ...base, FRED_API_KEY: "fred-key-value", TIINGO_API_KEY: "  " });
    expect(config.providers.fred).toEqual({ configured: true, credential: "fred-key-value" });
    expect(config.providers.tiingo).toEqual({ configured: false, reason: "未配置 TIINGO_API_KEY" });
    expect(config.providers.edgar.configured).toBe(false);
  });

  it("requires a contact email in the SEC user agent", () => {
    expect(() => parseConfig({ ...base, SEC_USER_AGENT: "ai-finance" })).toThrow(/联系邮箱/);
  });

  it("never includes secret values in error messages", () => {
    const secrets = { FINNHUB_API_KEY: "finnhub-secret-value", SESSION_SECRET: "tiny-secret" };
    try {
      parseConfig({ ...base, ...secrets });
      expect.unreachable();
    } catch (error) {
      const message = String((error as Error).message);
      expect(message).not.toContain("finnhub-secret-value");
      expect(message).not.toContain("tiny-secret");
      expect(message).not.toContain("db-password-value");
    }
  });

  it("only trusts forwarded headers when explicitly enabled", () => {
    expect(parseConfig(base).trustProxy).toBe(false);
    expect(parseConfig({ ...base, TRUST_PROXY: "true" }).trustProxy).toBe(true);
    expect(() => parseConfig({ ...base, TRUST_PROXY: "yes" })).toThrow(ConfigError);
  });
});
