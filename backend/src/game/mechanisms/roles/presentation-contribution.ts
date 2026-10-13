/**
 * 负责声明内建角色的展示贡献。输入为已实现角色 ID，输出只含 kind 与 ID 的冻结数据。
 * 声明不导入捕获、World、运行贡献或格式化器；实际组合根注入具体捕获函数，只有显示时
 * 才读取原生状态。这里没有旧 profile.renderPrompt 转发入口，用户原文另由明确自定义贡献负责。
 */
import type { NativeRolePresentationId } from "@ai-werewolf-arena/game-contract";
import type { RolePresentationContribution } from "./contracts";

export function nativeRolePresentation(
  id: NativeRolePresentationId,
): Extract<RolePresentationContribution, { kind: "native" }> {
  return Object.freeze({ kind: "native", id });
}
