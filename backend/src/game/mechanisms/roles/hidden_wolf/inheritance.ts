import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role, type GameEvent } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import { getHiddenWolfState } from "../private_state";

/** Read-only current permission, separate from the persistent acquired fact. */
export function canHiddenWolfKnife(role: RoleComponent, world?: World): boolean {
  if (
    !world ||
    role.role !== Role.HiddenWolf ||
    role.camp !== Camp.Wolf ||
    getHiddenWolfState(role)?.hasInheritedKnife !== true
  )
    return false;
  const wolves = world
    .getAliveEntityIds()
    .filter((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp === Camp.Wolf);
  return wolves.length === 1 && world.getComponent(wolves[0]!, COMPONENT.Role) === role;
}

/** Only opening assembly or the actual death owner commits this transition. */
export function refreshHiddenWolfInheritance(world: World, events: GameEvent[], day: number): void {
  const wolves = world
    .getAliveEntityIds()
    .filter((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp === Camp.Wolf);
  if (wolves.length !== 1) return;
  const actorId = wolves[0]!,
    role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role)!;
  const state = role.role === Role.HiddenWolf ? getHiddenWolfState(role) : undefined;
  if (!state || state.hasInheritedKnife) return;
  state.hasInheritedKnife = true;
  events.push({ timestamp: Date.now(), type: "hidden_wolf_awakened", payload: { actorId, day } });
}
