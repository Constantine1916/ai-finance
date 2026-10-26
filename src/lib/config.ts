import { z } from "zod";

// 运行时配置。只在服务端读取；错误信息只列出变量名，不输出变量值。

export type ProviderId = "fred" | "bea" | "finnhub" | "tiingo" | "edgar";

export type ProviderConfig =
  | { configured: true; credential: string }
  | { configured: false; reason: string };

export type AuthConfig =
  | { configured: true; username: string; passwordHash: string; sessionSecret: string }
  | { configured: false; missing: string[] };

export interface AppConfig {
  databaseUrl: string;
  trustProxy: boolean;
  auth: AuthConfig;
  providers: Record<ProviderId, ProviderConfig>;
}

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`运行时配置无效：${problems.join("；")}`);
    this.name = "ConfigError";
  }
}

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(blankToUndefined, z.string().trim().optional());

const envSchema = z.object({
  DATABASE_URL: z.preprocess(
    blankToUndefined,
    z.string({ error: "缺少 DATABASE_URL" }).refine((v) => /^postgres(ql)?:\/\//.test(v), "DATABASE_URL 必须是 postgres:// 连接串"),
  ),
  TRUST_PROXY: z.preprocess(blankToUndefined, z.enum(["true", "false"], { error: "TRUST_PROXY 只能是 true 或 false" }).default("false")),
  OWNER_USERNAME: optionalString,
  // Next.js 会展开 .env 中的 $，因此哈希在 .env 里写成 \$，这里还原
  OWNER_PASSWORD_HASH: z.preprocess(
    (v) => blankToUndefined(typeof v === "string" ? v.replaceAll("\\$", "$") : v),
    z.string().startsWith("$argon2id$", "OWNER_PASSWORD_HASH 必须是 Argon2id 哈希").optional(),
  ),
  SESSION_SECRET: z.preprocess(blankToUndefined, z.string().min(32, "SESSION_SECRET 至少 32 个字符").optional()),
  FRED_API_KEY: optionalString,
  BEA_API_KEY: optionalString,
  FINNHUB_API_KEY: optionalString,
  TIINGO_API_KEY: optionalString,
  SEC_USER_AGENT: z.preprocess(
    blankToUndefined,
    z.string().regex(/\S+@\S+\.\S+/, "SEC_USER_AGENT 必须包含联系邮箱").optional(),
  ),
});

const providerKeys: Record<ProviderId, keyof z.infer<typeof envSchema>> = {
  fred: "FRED_API_KEY",
  bea: "BEA_API_KEY",
  finnhub: "FINNHUB_API_KEY",
  tiingo: "TIINGO_API_KEY",
  edgar: "SEC_USER_AGENT",
};

export function parseConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => i.message));
  }
  const e = parsed.data;

  const missing = (["OWNER_USERNAME", "OWNER_PASSWORD_HASH", "SESSION_SECRET"] as const).filter((k) => !e[k]);
  const auth: AuthConfig =
    e.OWNER_USERNAME && e.OWNER_PASSWORD_HASH && e.SESSION_SECRET
      ? { configured: true, username: e.OWNER_USERNAME, passwordHash: e.OWNER_PASSWORD_HASH, sessionSecret: e.SESSION_SECRET }
      : { configured: false, missing };

  const providers = Object.fromEntries(
    (Object.keys(providerKeys) as ProviderId[]).map((id) => {
      const name = providerKeys[id];
      const value = e[name];
      return [id, typeof value === "string" ? { configured: true, credential: value } : { configured: false, reason: `未配置 ${name}` }];
    }),
  ) as Record<ProviderId, ProviderConfig>;

  return { databaseUrl: e.DATABASE_URL, trustProxy: e.TRUST_PROXY === "true", auth, providers };
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  cached ??= parseConfig(process.env);
  return cached;
}
