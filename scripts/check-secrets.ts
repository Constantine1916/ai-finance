import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// 扫描构建产物与日志，确认不包含 .env 中任何密钥的值。用法：npm run check:secrets -- [目录...]
const SECRET_NAMES = [
  "POSTGRES_PASSWORD",
  "DATABASE_URL",
  "OWNER_PASSWORD_HASH",
  "SESSION_SECRET",
  "FRED_API_KEY",
  "BEA_API_KEY",
  "FINNHUB_API_KEY",
  "TIINGO_API_KEY",
];

const secrets = SECRET_NAMES.map((name) => [name, process.env[name]?.trim()] as const).filter(
  (entry): entry is readonly [string, string] => Boolean(entry[1] && entry[1].length >= 8),
);

function* walk(path: string): Generator<string> {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat) return;
  if (stat.isFile()) {
    yield path;
    return;
  }
  for (const entry of readdirSync(path)) {
    if (entry === "node_modules" || entry === "cache") continue;
    yield* walk(join(path, entry));
  }
}

const targets = process.argv.slice(2);
const roots = targets.length > 0 ? targets : [".next"];
let leaks = 0;
let scanned = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    scanned++;
    const content = readFileSync(file, "latin1");
    for (const [name, value] of secrets) {
      if (content.includes(value)) {
        leaks++;
        console.error(`发现 ${name} 的值出现在 ${file}`);
      }
    }
  }
}
console.log(`扫描 ${scanned} 个文件，检查 ${secrets.length} 个密钥，发现 ${leaks} 处泄漏`);
process.exit(leaks > 0 ? 1 : 0);
