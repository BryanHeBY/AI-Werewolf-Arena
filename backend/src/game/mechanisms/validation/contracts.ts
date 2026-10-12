import type { RuleViolation } from "@ai-werewolf-arena/game-catalog";
/** 文件说明：工具校验规则契约定义。 */
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionWindow, EntityId, Phase, ToolCall, ToolName } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import type { RoleCatalog } from "../roles/catalog";

/** 单次工具校验上下文。 */
export interface ValidationRuleContext {
  day?: number;
  thiefScope?: object;
  shapeshifterScope?: object;
  wildChildScope?: object;
  lonelyGirlScope?: object;
  ghostBrideScope?: object;
  demonHunterScope?: object;
  nobleBodyScope?: object;
  fragrantPairScope?: object;
  animalScope?: object;
  wallScope?: object;
  wallId?: string;
  itemInstanceId?: string;
  debateId?: string;
  abilityId?: string;
  roleCatalog: RoleCatalog;
  world: World;
  actorId: EntityId;
  role: RoleComponent;
  toolCall: ToolCall;
  phase: Phase;
  actionWindow?: ActionWindow;
  allowSelfDestruct?: boolean;
  duelWindow?: import("../../../core/domain/identity").KnightDuelWindow;
  allowKnightDuel?: boolean;
  sheriffCandidates?: readonly EntityId[];
  badgeCandidates?: readonly EntityId[];
  exileCandidates?: readonly EntityId[];
}

/** 工具校验规则函数签名。 */
export type ToolRule = (ctx: ValidationRuleContext) => RuleViolation | string | null;

/** 判断目标玩家是否存活。 */
export function isAliveTarget(world: World, targetId: EntityId): boolean {
  const alive = world.getComponent<{ alive: boolean }>(targetId, COMPONENT.Alive);
  return alive?.alive === true;
}

/** 工具名到校验规则的映射表。 */
export type ToolRuleMap = Partial<Record<ToolName, ToolRule>>;
