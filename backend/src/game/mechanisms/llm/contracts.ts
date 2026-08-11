/** 文件说明：LLM 工具修复的上下文与处理器契约。 */
import { EntityId, Role, ToolName } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";

/** 参数纠正规则上下文。 */
export interface CoerceContext {
  actorId: EntityId;
}

/** 参数纠正处理器签名。 */
export type CoerceHandler = (
  args: Record<string, unknown>,
  ctx: CoerceContext,
) => Record<string, unknown> | null;

/** 单个原生工具参数纠正包定义。 */
export interface ToolRepairPack {
  coerce: Partial<Record<ToolName, CoerceHandler>>;
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
