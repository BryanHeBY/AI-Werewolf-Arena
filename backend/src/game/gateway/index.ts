/**
 * 为后端调用方统一导出动作校验器、校验上下文类型与工具网关。
 * 此出口不执行校验、持有请求许可或提交领域动作；实际准入与提交边界仍由相应所有者实现。
 */
export { ActionValidator } from "./action_validator";
export type { ValidationContext } from "./action_validator";
export { ToolGateway } from "./tool_gateway";
