import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role, type GameEvent } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import { currentAwakenedNight } from "./night_scope";
import { awakenedKnifeReady, getAwakenedState, recordAwakenedInheritance } from "./state";

export function canAwakenedKnife(role: RoleComponent, world?: World): boolean {
  const state = getAwakenedState(role),
    night = world && currentAwakenedNight(world, role);
  if (
    !world ||
    role.role !== Role.AwakenedHiddenWolf ||
    role.camp !== Camp.Wolf ||
    !state ||
    night == null ||
    !awakenedKnifeReady(state, night)
  )
    return false;
  const wolves = world
    .getAliveEntityIds()
    .filter((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp === Camp.Wolf);
  return wolves.length === 1 && world.getComponent(wolves[0]!, COMPONENT.Role) === role;
}
/** Only assembly and completed actual death proposals create persistent inheritance. */
export function refreshAwakenedInheritance(world: World, day: number, events: GameEvent[]): void {
  const wolves = world
    .getAliveEntityIds()
    .filter((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp === Camp.Wolf);
  if (wolves.length !== 1) return;
  const actorId = wolves[0]!,
    role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role)!,
    state = getAwakenedState(role);
  if (role.role !== Role.AwakenedHiddenWolf || !state || !recordAwakenedInheritance(state, day))
    return;
  events.push({
    timestamp: Date.now(),
    type: "awakened_inherited",
    payload: { actorId, day, firstKnifeNight: state.firstKnifeNight! },
  });
}
