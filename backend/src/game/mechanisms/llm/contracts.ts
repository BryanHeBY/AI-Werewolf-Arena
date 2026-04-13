/** 文件说明：LLM 工具修复的上下文与处理器契约。 */
import { EntityId, Role, ToolCall, ToolName } from "../../../domain/model";
import { World } from "../../../domain/world";

/** 文本恢复阶段上下文。 */
export interface RecoverContext {
  actorId: EntityId;
  world: World;
  toSpeakText: (text: string) => string;
}

/** 参数纠正规则上下文。 */
export interface CoerceContext {
  actorId: EntityId;
}

/** 参数纠正处理器签名。 */
export type CoerceHandler = (
  args: Record<string, unknown>,
  ctx: CoerceContext,
) => Record<string, unknown> | null;

/** 文本恢复处理器签名。 */
export type RecoverHandler = (
  text: string,
  ctx: RecoverContext,
) => ToolCall | null;

/** 单个修复包定义。 */
export interface ToolRepairPack {
  coerce: Partial<Record<ToolName, CoerceHandler>>;
  recover: Partial<Record<ToolName, RecoverHandler>>;
}

/** 可行动目标提示上下文。 */
export interface TargetHintContext {
  actorId: EntityId;
  actorRole?: Role;
  allowedTools: ToolName[];
  world: World;
}

/** 目标提示注册器契约。 */
export interface TargetHintRegistry {
  buildActionableIdsHint(ctx: TargetHintContext): string | undefined;
}
