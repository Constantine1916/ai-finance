import { RetryableError } from "@/pipeline/ingest";

// 供应商请求：429 与 5xx 可重试；错误信息只含状态码与来源名，不含地址（地址里可能有密钥）
export async function request(source: string, url: string, init: RequestInit & { signal: AbortSignal }): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new RetryableError(`${source} 请求超时`);
    throw new RetryableError(`${source} 网络错误`);
  }
  if (response.status === 429 || response.status >= 500) throw new RetryableError(`${source} 返回 HTTP ${response.status}`);
  if (!response.ok) throw new Error(`${source} 返回 HTTP ${response.status}`);
  return response;
}

export async function requestJson<T>(source: string, url: string, init: RequestInit & { signal: AbortSignal }): Promise<T> {
  const response = await request(source, url, init);
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${source} 返回的内容不是 JSON`);
  }
}
