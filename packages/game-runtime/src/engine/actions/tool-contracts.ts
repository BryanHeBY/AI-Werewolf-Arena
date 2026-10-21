/**
 * 负责定义机制工具、阶段提示和钩子的公共规格。输入为贡献方声明的工具名、参数 schema 与提示键；
 * 输出为装配方消费的类型约束。参数规格只描述校验，提示不授予库存／回合许可，本模块不运行工具或注册贡献。
 */
import type { MessageKey } from "@ai-werewolf-arena/game-text";
/** 文件说明：机制层公共规格类型定义。 */
import { ToolName } from "../../domain/model";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";

/** 工具规格定义。 */
export interface ToolSpec {
  name: ToolName;
  /** 高风险行动由共同选择窗口要求显式往返确认；不是领域提交的授权凭证。 */
  confirmation?: "self_destruct";
  /** 反馈只认可机制发表的这些事实；资源登记与即时获知结果具有不同语义。 */
  executionFeedback?: { kind: "resolved" | "committed"; events: readonly GameEvent["type"][] };
  /** 模型可见且用于新输入校验的 JSON Schema；动态资格仍由领域规则决定。 */
  parameters: Record<string, unknown>;
  /** 明确保留的旧输入结构；只用于接收兼容，不向新模型推广，也不替代领域校验。 */
  legacyParameters?: Record<string, unknown>;
  /** 旧公开简写接口保留兼容；模型的参数说明从 parameters 自动生成。 */
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
