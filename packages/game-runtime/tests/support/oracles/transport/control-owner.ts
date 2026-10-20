/**
 * 测试支持模块负责持有 control-owner HTTP 探测的原字面关闭预期；输入为观察的状态／正文或传输错误及原 finish／fail 回调，输出保留关闭／不同 owner 分类及错误。不分配网络、定时器、进程、令牌或玩法权限；驱动仍持有原解析 catch、请求与清理顺序。
 */
export function classifyControlResponse(
  response: { readonly statusCode?: number },
  body: any,
  finish: (value: "closed" | "reused_by_different_owner") => void,
  fail: (error: Error) => void,
): void {
  if (response.statusCode === 401 && body?.ok === false && body?.error === "unauthorized")
    finish("reused_by_different_owner");
  else fail(new Error(`fixture_control_owner_still_reachable_or_unknown_${response.statusCode}`));
}

export function classifyControlRequestError(
  error: NodeJS.ErrnoException,
  finish: (value: "closed" | "reused_by_different_owner") => void,
  fail: (error: Error) => void,
): void {
  if (error.code === "ECONNREFUSED") finish("closed");
  else fail(new Error(`fixture_control_probe_request_error_${error.code ?? "unknown"}`));
}
