import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { getConfig } from "@/lib/config";
import { isSessionValid, SESSION_COOKIE } from "./session";

export type OwnerCheck = "ok" | "unauthenticated" | "unconfigured" | "unavailable";

let warnedMissing = false;

// 所有受保护页面与接口共用的服务端校验。缺少配置或数据库故障时拒绝，绝不放行。
export async function checkOwner(token: string | undefined): Promise<OwnerCheck> {
  const { auth } = getConfig();
  if (!auth.configured) {
    if (!warnedMissing) {
      console.error(`访问保护未配置，缺少：${auth.missing.join("、")}；受保护页面一律拒绝`);
      warnedMissing = true;
    }
    return "unconfigured";
  }
  if (!token) return "unauthenticated";
  try {
    return (await isSessionValid(getDb(), auth.sessionSecret, token)) ? "ok" : "unauthenticated";
  } catch (error) {
    console.error("会话校验失败：数据库不可用", error instanceof Error ? error.message : error);
    return "unavailable";
  }
}

export async function requireOwner(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const result = await checkOwner(token);
  if (result !== "ok") redirect(`/login?reason=${result}`);
}

const denied: Record<Exclude<OwnerCheck, "ok">, [number, string]> = {
  unauthenticated: [401, "未登录"],
  unconfigured: [503, "访问保护未配置"],
  unavailable: [503, "服务暂不可用"],
};

// 包装接口处理函数：校验不通过时直接返回错误，处理函数不会执行
export function withOwner<Args extends unknown[]>(handler: (request: Request, ...args: Args) => Promise<Response>) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const result = await checkOwner(token);
    if (result !== "ok") {
      const [status, error] = denied[result];
      return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
    }
    return handler(request, ...args);
  };
}
