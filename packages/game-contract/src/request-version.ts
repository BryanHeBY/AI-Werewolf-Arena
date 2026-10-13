/**
 * 负责行动请求的显式语义身份声明，供实际录制与严格复现消费；本契约是该声明的唯一所有者。
 * 输入为本版本的请求字段、公共上下文和许可语义；输出为稳定 id 与版本，不包含运行请求或授权句柄。
 * 该版本不是源码签名，也不允许跨构建重放；实际 source／lock／RNG 仍须匹配。
 */
export const ACTION_REQUEST_CONTRACT = Object.freeze({
  id: "awa-action-request",
  version: "1",
} as const);
