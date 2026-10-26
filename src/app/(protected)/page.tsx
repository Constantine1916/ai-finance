import { requireOwner } from "@/lib/auth/guard";

// 总览页占位。每个受保护页面自身也调用 requireOwner，不只依赖布局。
export default async function Home() {
  await requireOwner();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">总览</h1>
      <p className="mt-3 text-[var(--muted)]">已登录。宏观数据页面将在后续任务中加入。</p>
    </main>
  );
}
