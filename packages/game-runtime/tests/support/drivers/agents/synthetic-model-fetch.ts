/**
 * 持有测试专用合成模型令牌和认证 fetch handler，保留先认证后解析载荷的顺序。输入为脚本步骤、回调或夹具资源请求，输出为原受控轨迹、句柄和边界响应。单元／场景测试以调用方字面行动和失败预期为依据；迁移不改变驱动所有权、清理或错误政策，不引入计费模型。
 */
/**
 * 每局独立拥有夹具令牌，不依赖已释放的本地回环端口。
 */
export function syntheticModelToken(): string {
  return `synthetic-${crypto.randomUUID()}`;
}

export function authenticatedSyntheticModelFetch(
  token: string,
  handler: (request: Request) => Response | Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    // 先认证，再解析 URL 与 JSON；旧 control owner 的探测
    // 可能在原服务器关闭后抵达已复用端口。
    if (request.headers.get("authorization") !== `Bearer ${token}`)
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    return handler(request);
  };
}
