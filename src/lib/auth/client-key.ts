// 限流使用的连接来源。只有配置了可信代理（Nginx 用 $remote_addr 覆盖 X-Real-IP）时才读取转发头；
// 否则应用拿不到可信的客户端地址，所有登录尝试共用一个限流桶，伪造的转发头不起作用。
export function clientKey(headers: Headers, trustProxy: boolean): string {
  if (!trustProxy) return "direct";
  const realIp = headers.get("x-real-ip")?.trim();
  return realIp ? `ip:${realIp}` : "proxy:unknown";
}
