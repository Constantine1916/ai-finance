import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { clientKey } from "@/lib/auth/client-key";
import { checkCredentials } from "@/lib/auth/credentials";
import { isLoginBlocked, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { isSameOrigin } from "@/lib/auth/same-origin";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

// 使用相对地址跳转，在 Nginx 反向代理后也指向正确的域名
function seeOther(location: string) {
  return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store" } });
}

function back(error: string) {
  return seeOther(`/login?error=${error}`);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return Response.json({ error: "跨站请求被拒绝" }, { status: 403 });

  const config = getConfig();
  if (!config.auth.configured) {
    console.error(`访问保护未配置，缺少：${config.auth.missing.join("、")}`);
    return back("unconfigured");
  }

  const form = await request.formData().catch(() => null);
  const username = String(form?.get("username") ?? "");
  const password = String(form?.get("password") ?? "");
  const key = clientKey(request.headers, config.trustProxy);

  try {
    const db = getDb();
    if (await isLoginBlocked(db, key)) return back("rate_limited");

    const ok = await checkCredentials({ username, password }, config.auth);
    await recordLoginAttempt(db, key, ok);
    if (!ok) return back("invalid");

    const { token, expiresAt } = await createSession(db, config.auth.sessionSecret);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return seeOther("/");
  } catch (error) {
    console.error("登录失败：数据库不可用", error instanceof Error ? error.message : error);
    return back("unavailable");
  }
}
