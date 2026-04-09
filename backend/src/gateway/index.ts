
/**
 * gateway 层统一导出入口：聚合动作校验、工具网关与 schema。
 */
export { ActionValidator } from "./action_validator";
export type { ValidationContext } from "./action_validator";
export { ToolGateway } from "./tool_gateway";

export { guardSchema } from "./schemas/guard.schema";
export { selfDestructSchema } from "./schemas/self_destruct.schema";
export { shootSchema } from "./schemas/shoot.schema";
export { usePotionSchema } from "./schemas/use_potion.schema";
