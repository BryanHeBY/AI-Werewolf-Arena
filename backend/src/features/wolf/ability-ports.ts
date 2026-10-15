/**
 * 负责公开共享普通狼贡献与五个实际能力常量，供派生角色通过具名公共边界复用。
 * 输入为本族唯一装配对象与原工具／阶段／校验／提示／修复常量；输出是原 same-binding 引用，不复制数组或包装方法。
 * 普通狼贡献对象的 metadata／runtime 仍在原调用点晚读，直接能力常量仍保持原独立变量语义。
 * 本端口不建立角色注册、生命周期或权限屏障；与狼刀查询端口分开，避免夜间 handler 反向导入自身装配。
 */
export { ORDINARY_WOLF_CONTRIBUTIONS } from "./ability-assembly";
export { WOLF_NIGHT_STAGES } from "./night-stages";
export { WOLF_TOOL_SPECS, WOLF_STAGE_DIRECTIVES } from "./tool-specs";
export { WOLF_VALIDATION_RULES } from "../../rulesets/wolf-tool-admission";
export { WOLF_LLM_REPAIR_PACK } from "./llm-repair";
