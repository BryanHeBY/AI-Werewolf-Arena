/**
 * 负责定义机制工具、阶段提示和钩子的公共规格。输入为贡献方声明的工具名、参数 schema 与提示键；
 * 输出为装配方消费的类型约束。参数规格只描述校验，提示不授予库存／回合许可，本模块不运行工具或注册贡献。
 */
import type { MessageKey } from "@ai-werewolf-arena/game-text";
/** 文件说明：机制层公共规格类型定义。 */
import { ToolName } from "../../core/domain/model";

/** 工具规格定义。 */
export interface ToolSpec {
  name: ToolName;
  /** 只用于校验的 JSON Schema；玩家说明由共享本地化提示提供，不写进 schema。 */
  parameters: Record<string, unknown>;
  argHint: string;
  userPromptHint?: string;
  userPromptHintKey?: MessageKey;
}

/** 阶段提示词匹配规则。 */
export interface StageDirectiveRule {
  match: (allowedTools: ToolName[]) => boolean;
  text: string;
  messageKey?: MessageKey;
}

/** 阶段规格定义。 */
export interface StageSpec {
  id: string;
  phase: string;
  description?: string;
}

/** 钩子规格定义。 */
export interface HookSpec {
  id: string;
  event: "voted_out" | "death";
  description?: string;
}
