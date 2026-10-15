/**
 * 向配置解析与游戏装配调用方导出生产规则集的有限支持契约。
 * 输入为本目录既有判定与入口，输出为原支持函数、有序拒绝分派及独立 Node 猎魔人入口。
 * 这些裁决不执行游戏或授予行动权限；归档验证使用各自独立的板子检查。
 */
export * from "./support";
export { boardPresetViolation } from "./board-support";
export { isDemonHunterPreset as isDemonHunterNodePreset } from "./node-board-support";
