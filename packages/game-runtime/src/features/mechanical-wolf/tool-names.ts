/**
 * 负责列出机械狼的静态工具名。输入为类型层工具名约束；输出为原有序名称数组。
 * 只读类型不等于运行冻结，也不持角色状态、模式、学习库存或当前请求许可。
 */
import type { ToolName } from "../../domain/model";

/** 静态名称不依赖运行私态；具体模式／技能可用性仍由实际实例和阶段判断。 */
export const MECHANICAL_TOOL_NAMES = [
  "mimic_role",
  "mechanical_mode",
  "mechanical_inspect",
  "mechanical_poison",
  "mechanical_guard",
  "mechanical_attack",
] as const satisfies readonly ToolName[];
