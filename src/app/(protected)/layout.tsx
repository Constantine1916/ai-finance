import Link from "next/link";
import { requireOwner } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="font-semibold">
            AI Finance
          </Link>
          <Link href="/data" className="text-[var(--muted)] hover:text-[var(--text)]">
            数据健康
          </Link>
        </nav>
        <form method="post" action="/api/auth/logout">
          <button type="submit" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
            退出
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
