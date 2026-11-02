"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "总览" },
  { href: "/macro", label: "宏观" },
  { href: "/ai", label: "AI 产业" },
  { href: "/calendar", label: "日历" },
  { href: "/data", label: "数据健康" },
];

// 信号详情属于总览，个股详情属于 AI 产业
const activeFor = (path: string) => (path.startsWith("/signals") ? "/" : path.startsWith("/stocks") ? "/ai" : path);

export default function MainNav() {
  const active = activeFor(usePathname());
  return (
    <nav aria-label="主导航" className="-mb-px flex items-stretch gap-1 overflow-x-auto text-sm">
      {ITEMS.map((item) => {
        const current = item.href === "/" ? active === "/" : active.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`flex items-center whitespace-nowrap border-b-2 px-3 py-3 ${current ? "border-[var(--text)] text-[var(--text)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
