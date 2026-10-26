import { hash } from "@node-rs/argon2";
import { createInterface } from "node:readline/promises";

// 生成所有者密码的 Argon2id 哈希，写入 .env 的 OWNER_PASSWORD_HASH。密码不回显、不落盘。
const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
const password = await rl.question("输入所有者密码：");
rl.close();
if (password.length < 12) {
  console.error("密码至少 12 个字符");
  process.exit(1);
}
console.log(await hash(password));
