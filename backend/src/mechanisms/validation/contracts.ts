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

export interface ValidationRuleContext {
  world: World;
  actorId: EntityId;
  role: RoleComponent;
  toolCall: ToolCall;
  phase: Phase;
  actionWindow?: ActionWindow;
  allowSelfDestruct?: boolean;
}

export type ToolRule = (ctx: ValidationRuleContext) => string | null;

export function isAliveTarget(world: World, targetId: EntityId): boolean {
  const alive = world.getComponent<{ alive: boolean }>(targetId, COMPONENT.Alive);
  return alive?.alive === true;
}

export type ToolRuleMap = Partial<Record<ToolName, ToolRule>>;

