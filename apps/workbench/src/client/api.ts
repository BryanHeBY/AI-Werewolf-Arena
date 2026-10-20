/** 负责浏览器的同源 JSON 请求；输入受限 API 路径和数据，输出类型化响应。失败保留固定码，不解析终端文字。 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly path?: string,
  ) {
    super(code);
  }
}
export async function api<T>(
  url: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`/api/${url}`, {
    method: options.method ?? "GET",
    signal: options.signal,
    headers: options.body === undefined ? undefined : { "content-type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(
      body.error ?? "request_failed",
      response.status,
      body.diagnostics?.[0]?.path,
    );
  return body as T;
}
