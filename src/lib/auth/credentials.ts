import { timingSafeEqual } from "node:crypto";
import { verify } from "@node-rs/argon2";

function sameText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// 用户名错误时仍执行一次哈希校验，避免通过响应时间判断用户名是否存在
export async function checkCredentials(
  input: { username: string; password: string },
  owner: { username: string; passwordHash: string },
) {
  const passwordOk = await verify(owner.passwordHash, input.password).catch(() => false);
  return sameText(input.username, owner.username) && passwordOk;
}
