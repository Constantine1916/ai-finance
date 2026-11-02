const messages: Record<string, string> = {
  invalid: "用户名或密码不正确。",
  rate_limited: "登录失败次数过多，请 15 分钟后再试。",
  unconfigured: "服务端未配置登录凭据，暂时无法登录。",
  unavailable: "服务暂不可用，请稍后再试。",
  unauthenticated: "请先登录。",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reason?: string }> }) {
  const { error, reason } = await searchParams;
  const message = messages[error ?? ""] ?? (reason && reason !== "unauthenticated" ? messages[reason] : undefined);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <p className="eyebrow">AI FINANCE · 仅限所有者</p>
      <h1 className="page-title mt-2">登录看板</h1>
      {message && (
        <p role="alert" className="mt-4 rounded border border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3 py-2 text-sm text-[var(--warn)]">
          {message}
        </p>
      )}
      <form method="post" action="/api/auth/login" className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          用户名
          <input name="username" autoComplete="username" required className="field px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          密码
          <input name="password" type="password" autoComplete="current-password" required className="field px-3 py-2" />
        </label>
        <button type="submit" className="mt-2 btn-primary py-2">
          登录
        </button>
      </form>
    </main>
  );
}
