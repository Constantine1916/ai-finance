import Link from "next/link";
import MainNav from "@/components/MainNav";
import { requireOwner } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-7xl items-stretch gap-3 px-4 sm:gap-6">
          <Link href="/" aria-label="AI Finance 总览" className="mono flex shrink-0 items-center gap-2 whitespace-nowrap text-[13px] font-semibold tracking-[0.18em]">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-[var(--text)]" />
            <span className="hidden sm:inline">AI FINANCE</span>
          </Link>
          <div className="min-w-0 flex-1">
            <MainNav />
          </div>
          <form method="post" action="/api/auth/logout" className="flex shrink-0 items-center">
            <button type="submit" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
              退出
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
