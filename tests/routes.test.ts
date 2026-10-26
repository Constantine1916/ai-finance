import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// 静态检查 src/app：每个接口都经过 withOwner，每个受保护页面都调用 requireOwner，没有注册入口
const APP = "src/app";
const PUBLIC_ROUTES = new Set(["api/health/route.ts", "api/auth/login/route.ts", "api/auth/logout/route.ts"]);
const PUBLIC_PAGES = new Set(["login/page.tsx"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [relative(APP, path)];
  });
}

const all = files(APP);

describe("route protection", () => {
  it("wraps every non-public API handler with withOwner", () => {
    const routes = all.filter((f) => f.endsWith("route.ts") && !PUBLIC_ROUTES.has(f));
    for (const route of routes) {
      const source = readFileSync(join(APP, route), "utf8");
      const handlers = [...source.matchAll(/export (?:async function|const) (GET|POST|PUT|PATCH|DELETE)\b/g)];
      for (const [, method] of handlers) {
        expect(source, `${route} ${method}`).toMatch(new RegExp(`export const ${method} = withOwner\\(`));
      }
    }
  });

  it("calls requireOwner in every page outside the public set", () => {
    const pages = all.filter((f) => f.endsWith("page.tsx") && !PUBLIC_PAGES.has(f));
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(page.startsWith("(protected)/"), `${page} 必须放在 (protected) 下`).toBe(true);
      expect(readFileSync(join(APP, page), "utf8"), page).toContain("await requireOwner()");
    }
  });

  it("has no registration entry point", () => {
    expect(all.filter((f) => /register|sign-?up/i.test(f))).toEqual([]);
  });
});
