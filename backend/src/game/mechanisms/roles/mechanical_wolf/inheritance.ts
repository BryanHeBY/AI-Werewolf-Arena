/**
 * Checks Mechanical Wolf knife succession and records its inherited knife fact. Inputs are
 * actual surviving wolves and original mechanical state; outputs retain the current inheritance
 * predicate. It never changes the copied skill inventory or the player role/camp.
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role, type EntityId, type GameEvent } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import { hasCurrentMechanicalKillMode } from "./night_scope";
import { getMechanicalState, mechanicalKnifeSelected, recordMechanicalInheritance } from "./state";

export interface MechanicalInheritanceFact {
  readonly actorId: EntityId;
  readonly day: number;
  readonly firstKnifeNight: number;
}

/** Queries are conservative and never create inheritance or restore past mode authority. */
export function canMechanicalKnife(role: RoleComponent, world?: World): boolean {
  const state = getMechanicalState(role);
  if (
    !world ||
    role.role !== Role.MechanicalWolf ||
    role.camp !== Camp.Wolf ||
    !state ||
    !mechanicalKnifeSelected(state, state.mode?.day ?? 0) ||
    !hasCurrentMechanicalKillMode(world, role)
  )
    return false;
  const wolves = world
    .getAliveEntityIds()
    .filter((id) => world.getComponent(id, COMPONENT.Role)?.camp === Camp.Wolf);
  return wolves.length === 1 && world.getComponent(wolves[0]!, COMPONENT.Role) === role;
}

/** Called only by assembly or the death owner after marking the complete actual proposal. */
export function refreshMechanicalInheritance(
  world: World,
  day: number,
  events?: GameEvent[],
): MechanicalInheritanceFact[] {
  const wolves = world
    .getAliveEntityIds()
    .filter((id) => world.getComponent(id, COMPONENT.Role)?.camp === Camp.Wolf);
  if (wolves.length !== 1) return [];
  const actorId = wolves[0]!,
    role = world.getComponent(actorId, COMPONENT.Role)!;
  if (role.role !== Role.MechanicalWolf) return [];
  const state = getMechanicalState(role);
  if (!state || !recordMechanicalInheritance(state, day)) return [];
  const fact = { actorId, day, firstKnifeNight: state.firstKnifeNight! };
  events?.push({ timestamp: Date.now(), type: "mechanical_awakened", payload: fact });
  return [fact];
}
