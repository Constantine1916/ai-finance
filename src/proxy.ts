import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { isPublicPath } from "@/lib/auth/public-paths";

// 第一道门：没有会话 Cookie 的请求直接拦下。会话是否有效由页面与接口在服务端再次校验。
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "未登录" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
