import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, type EntityId } from "../../../../core/domain/model";
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
  if (!world || String(role.role) !== "mechanical_wolf" || role.camp !== Camp.Wolf || !state ||
      !mechanicalKnifeSelected(state, state.mode?.day ?? 0) || !hasCurrentMechanicalKillMode(world, role)) return false;
  const wolves = world.getAliveEntityIds().filter(id => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp === Camp.Wolf);
  return wolves.length === 1 && world.getComponent(wolves[0]!, COMPONENT.Role) === role;
}

/** Called only by assembly or the death owner after marking the complete actual proposal. */
export function refreshMechanicalInheritance(world: World, day: number): MechanicalInheritanceFact[] {
  const wolves = world.getAliveEntityIds().filter(id => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp === Camp.Wolf);
  if (wolves.length !== 1) return [];
  const actorId = wolves[0]!, role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role)!;
  if (String(role.role) !== "mechanical_wolf") return [];
  const state = getMechanicalState(role);
  if (!state || !recordMechanicalInheritance(state, day)) return [];
  return [{ actorId, day, firstKnifeNight: state.firstKnifeNight! }];
}
