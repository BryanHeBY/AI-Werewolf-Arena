/**
 * 负责角色工具校验契约和存活目标查询。公开规则输入为窄值查询与候选；可信宿主的生命查询辅助保原 World 输入，输出规则结果及生命资格。
 * 这些结构不保存第二份运行授权，也不执行提交的工具或付款。
 */
import type { RuleViolation } from "@ai-werewolf-arena/game-contract";
/** 文件说明：工具校验规则契约定义。 */
import { COMPONENT } from "../../domain/components/names";
import { ActionWindow, EntityId, Phase, ToolCall, ToolName } from "../../domain/model";
import { World } from "../../domain/world";
import type { ValidationQueries } from "./validation-queries";

/** 单次工具校验上下文。 */
export interface ValidationRuleContext {
  day?: number;
  wallId?: string;
  itemInstanceId?: string;
  debateId?: string;
  abilityId?: string;
  readonly queries: ValidationQueries;
  actorId: EntityId;
  toolCall: ToolCall;
  phase: Phase;
  actionWindow?: ActionWindow;
  allowSelfDestruct?: boolean;
  duelWindow?: import("../../domain/identity").KnightDuelWindow;
  allowKnightDuel?: boolean;
  sheriffCandidates?: readonly EntityId[];
  badgeCandidates?: readonly EntityId[];
  exileCandidates?: readonly EntityId[];
}

/** 工具校验规则函数签名。 */
export type ToolRule = (ctx: ValidationRuleContext) => RuleViolation | string | null;

/** 判断目标玩家是否存活。 */
export function isAliveTarget(world: World, targetId: EntityId): boolean {
  const alive = world.getComponent(targetId, COMPONENT.Alive);
  return alive?.alive === true;
}

/** 工具名到校验规则的映射表。 */
export type ToolRuleMap = Partial<Record<ToolName, ToolRule>>;
