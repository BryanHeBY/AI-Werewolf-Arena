import type { MessageKey } from "@ai-werewolf-arena/game-text";
/** 文件说明：机制层公共规格类型定义。 */
import { ToolName } from "../../core/domain/model";

/** 工具规格定义。 */
export interface ToolSpec {
  name: ToolName;
  /** Validation-only JSON Schema; player prose belongs to shared localized hints. */
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
