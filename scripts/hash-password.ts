import { hash } from "@node-rs/argon2";
import { createInterface } from "node:readline/promises";

// 生成所有者密码的 Argon2id 哈希，把输出的整行写入 .env。密码不回显、不落盘。
const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
const password = await rl.question("输入所有者密码：");
rl.close();
if (password.length < 12) {
  console.error("密码至少 12 个字符");
  process.exit(1);
}
// 输出时把 $ 转义为 \$：Next.js 读取 .env 时会展开未转义的 $
console.log(`OWNER_PASSWORD_HASH=${(await hash(password)).replaceAll("$", "\\$")}`);
