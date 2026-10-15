/**
 * 负责列出觉醒隐狼的静态工具名。输入为类型层工具名约束；输出为原有序名称数组。
 * 数组的只读类型不等于运行冻结，也不持角色状态、库存、请求绑定或执行权限。
 */
import type { ToolName } from "../../domain/model";

/** 静态名称不依赖运行私态；具体技能可用性仍由实际实例和阶段判断。 */
export const AWAKENED_TOOL_NAMES = [
  "awakened_mimic",
  "awakened_poison",
  "awakened_guard",
  "awakened_attack",
] as const satisfies readonly ToolName[];
