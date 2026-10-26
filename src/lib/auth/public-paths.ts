// 不需要登录的路径：登录入口与不含数据的健康检查。新增公开路径必须加在这里并有测试覆盖。
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/api/health"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}
