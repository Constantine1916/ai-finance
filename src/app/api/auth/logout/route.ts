import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { isSameOrigin } from "@/lib/auth/same-origin";
import { revokeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return Response.json({ error: "跨站请求被拒绝" }, { status: 403 });
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const { auth } = getConfig();
  if (auth.configured) {
    await revokeSession(getDb(), auth.sessionSecret, token).catch((error) =>
      console.error("撤销会话失败", error instanceof Error ? error.message : error),
    );
  }
  store.delete(SESSION_COOKIE);
  return new Response(null, { status: 303, headers: { Location: "/login", "Cache-Control": "no-store" } });
}
