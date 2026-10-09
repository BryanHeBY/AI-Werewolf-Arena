import { COMPONENT, Role, Camp, type RoleComponent, type World } from "../../../../core/domain";
import { livingNightLife, type NightLifeScope } from "../../../../core/domain/night_effects";
import type { NightStageState } from "../../stages/night/contracts";
const committed = new WeakMap<World, Set<number>>();
export function hasFoxInspectionNightCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}
/** Snapshot before await; a new identity cannot acquire an old pending inspection. */
export function captureInspectionIdentity(world: World, target: NightLifeScope) {
  const role = world.getComponent<RoleComponent>(target.id, COMPONENT.Role);
  const kind = role?.role,
    camp = role?.camp,
    state = role?.privateState;
  return {
    role,
    isCurrent: () =>
      livingNightLife(world, target) &&
      world.getComponent(target.id, COMPONENT.Role) === role &&
      role?.role === kind &&
      role?.camp === camp &&
      role?.privateState === state,
  };
}
/** Only committed Seer-kind actions call this; read-only and role inspection never do. */
export function commitFoxInspection(
  world: World,
  state: NightStageState,
  target: NightLifeScope,
  day: number,
  ownerCurrent: () => boolean,
): void {
  const identity = captureInspectionIdentity(world, target);
  if (identity.role?.role !== Role.CursedFox || identity.role.camp !== Camp.ThirdParty) return;
  (state.foxInspections ??= []).push({
    target,
    isTargetCurrent: identity.isCurrent,
    isCurrent: () => ownerCurrent() && identity.isCurrent(),
  });
  const days = committed.get(world) ?? new Set<number>();
  days.add(day);
  committed.set(world, days);
}
