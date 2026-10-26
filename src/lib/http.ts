// 表单接口统一的跳转：相对地址，在反向代理后也正确
export function seeOther(location: string) {
  return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store" } });
}

export function backWith(path: string, params: Record<string, string>) {
  return seeOther(`${path}?${new URLSearchParams(params).toString()}`);
}
