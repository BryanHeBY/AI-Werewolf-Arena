/** 文件说明：工具校验规则契约定义。 */
import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import {
  ActionWindow,
  EntityId,
  Phase,
  ToolCall,
  ToolName,
} from "../../domain/model";
import { World } from "../../domain/world";

/** 单次工具校验上下文。 */
export interface ValidationRuleContext {
  world: World;
  actorId: EntityId;
  role: RoleComponent;
  toolCall: ToolCall;
  phase: Phase;
  actionWindow?: ActionWindow;
  allowSelfDestruct?: boolean;
}

/** 工具校验规则函数签名。 */
export type ToolRule = (ctx: ValidationRuleContext) => string | null;

/** 判断目标玩家是否存活。 */
export function isAliveTarget(world: World, targetId: EntityId): boolean {
  const alive = world.getComponent<{ alive: boolean }>(targetId, COMPONENT.Alive);
  return alive?.alive === true;
}

/** 工具名到校验规则的映射表。 */
export type ToolRuleMap = Partial<Record<ToolName, ToolRule>>;
