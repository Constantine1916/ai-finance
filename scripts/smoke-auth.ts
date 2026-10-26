// 对运行中的生产构建做访问保护冒烟测试：npm run smoke:auth -- <基础地址> <模式>
// 模式 normal 需要 SMOKE_PASSWORD；unconfigured 与 db-down 对应缺少凭据、数据库不可用的启动方式。
const [base = "http://127.0.0.1:3020", mode = "normal"] = process.argv.slice(2);
const siteOrigin = new URL(base).origin;
const username = process.env.OWNER_USERNAME ?? "constantine";
const password = process.env.SMOKE_PASSWORD ?? "";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "通过" : "失败"}  ${name}${detail ? `（${detail}）` : ""}`);
  if (!ok) failures++;
}

const get = (path: string, cookie?: string, headers: Record<string, string> = {}) =>
  fetch(base + path, { redirect: "manual", headers: { ...(cookie ? { cookie } : {}), ...headers } });

const login = (user: string, pass: string, headers: Record<string, string> = {}) =>
  fetch(`${base}/api/auth/login`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: siteOrigin, "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams({ username: user, password: pass }),
  });

const redirectTo = (r: Response) => r.headers.get("location") ?? "";
const sessionCookie = (r: Response) => r.headers.get("set-cookie")?.match(/af_session=[^;]+/)?.[0];

if (mode === "normal") {
  const health = await get("/api/health");
  check("健康检查只返回存活状态", health.status === 200 && JSON.stringify(await health.json()) === '{"status":"ok"}');

  for (const path of ["/", "/macro", "/data", "/register", "/sign-up"]) {
    const r = await get(path);
    check(`未登录访问 ${path} 跳转登录`, r.status === 307 && redirectTo(r).endsWith("/login"), String(r.status));
  }
  for (const path of ["/api/series", "/api/manual-entries"]) {
    const r = await get(path);
    const body = await r.text();
    check(`未登录调用 ${path} 被拒绝且不含数据`, r.status === 401 && body === '{"error":"未登录"}', String(r.status));
  }

  const forged = await get("/", "af_session=forged-token-value");
  check("伪造会话 Cookie 被拒绝", forged.status === 307 && redirectTo(forged).includes("/login"), String(forged.status));

  const crossSite = await login(username, password, { origin: "https://evil.example" });
  check("跨站登录请求被拒绝", crossSite.status === 403, String(crossSite.status));

  const wrong = await login(username, "wrong-password");
  check("错误密码返回通用提示", wrong.status === 303 && redirectTo(wrong).includes("error=invalid") && !sessionCookie(wrong));
  const wrongUser = await login("nobody", password);
  check("错误用户名与错误密码提示相同", redirectTo(wrongUser) === redirectTo(wrong));

  const ok = await login(username, password);
  const cookie = sessionCookie(ok);
  const setCookie = ok.headers.get("set-cookie") ?? "";
  check("正确凭据登录成功", ok.status === 303 && redirectTo(ok).endsWith("/") && Boolean(cookie), String(ok.status));
  check("会话 Cookie 为 HttpOnly 与 SameSite=Lax", /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie));

  const home = await get("/", cookie);
  check("登录后可访问总览", home.status === 200 && (await home.text()).includes("总览"), String(home.status));
  const missing = await get("/register", cookie);
  check("登录后注册路径不存在", missing.status === 404, String(missing.status));

  const logout = await fetch(`${base}/api/auth/logout`, { method: "POST", redirect: "manual", headers: { origin: siteOrigin, cookie: cookie ?? "" } });
  check("退出跳转登录页", logout.status === 303 && redirectTo(logout).endsWith("/login"));
  const after = await get("/", cookie);
  check("退出后旧会话被服务端拒绝", after.status === 307 && redirectTo(after).includes("/login"), String(after.status));

  // 限流：未配置可信代理时，伪造的转发 IP 不能绕开限流
  let last: Response | undefined;
  for (let i = 0; i < 6; i++) last = await login(username, "wrong-password", { "x-real-ip": `203.0.113.${i}`, "x-forwarded-for": `203.0.113.${i}` });
  check("连续失败后限流", Boolean(last && redirectTo(last).includes("error=rate_limited")), last ? redirectTo(last) : "");
  const blocked = await login(username, password, { "x-real-ip": "198.51.100.77" });
  check("限流期间伪造转发头的正确凭据也被拒绝", redirectTo(blocked).includes("error=rate_limited"));
} else if (mode === "unconfigured") {
  const r = await get("/", "af_session=anything");
  check("缺少凭据时受保护页面拒绝", r.status === 307 && redirectTo(r).includes("reason=unconfigured"), redirectTo(r));
  const l = await login(username, password || "x");
  check("缺少凭据时无法登录", redirectTo(l).includes("error=unconfigured"), redirectTo(l));
} else if (mode === "db-down") {
  const r = await get("/", "af_session=anything");
  check("数据库不可用时不放行", r.status === 307 && redirectTo(r).includes("reason=unavailable"), redirectTo(r));
  const l = await login(username, password || "x");
  check("数据库不可用时登录失败", redirectTo(l).includes("error=unavailable"), redirectTo(l));
}

console.log(failures === 0 ? "全部通过" : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);

export {};
