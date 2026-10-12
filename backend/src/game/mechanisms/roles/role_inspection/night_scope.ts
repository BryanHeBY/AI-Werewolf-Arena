/**
 * Records role-inspection night commitment and optional inspection completion. Inputs are World,
 * real night and the completed Gargoyle/inspection choice; outputs are per-night bookkeeping and
 * completed target knowledge. This ledger never manufactures an active ability or a second
 * inspection resource.
 */
import { aliveLifeVersion, type AliveComponent } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Role } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import { findNightAbility, roleInspectionPolicy, type NightAbility } from "../abilities";
import { getGargoyleState, type GargoyleState, type RoleInspectionState } from "../private_state";

interface Completion {
  actorId: number;
  role: RoleComponent;
  privateState: RoleComponent["privateState"];
  state: GargoyleState;
  ability: NightAbility<"role_check">;
  abilityId: string;
  activation: NightAbility["activation"];
  inspection: RoleInspectionState;
  inspectionPolicy: RoleInspectionState["inspectionPolicy"];
  life: AliveComponent;
  version: number;
  isCurrent: () => boolean;
}
const nights = new WeakMap<World, { day: number; completed: Map<RoleComponent, Completion> }>();
const committed = new WeakMap<World, Set<number>>();
export function hasRoleInspectionNightCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}
export function beginRoleInspectionNight(world: World, day: number): void {
  if (nights.get(world)?.day !== day) nights.set(world, { day, completed: new Map() });
}
export function recordRoleInspectionNightCommit(
  world: World,
  day: number,
  isCurrent: () => boolean,
): void {
  if (!isCurrent()) return;
  const days = committed.get(world) ?? new Set<number>();
  days.add(day);
  committed.set(world, days);
}
export function recordRoleInspectionCompletion(
  world: World,
  actorId: number,
  day: number,
  ability: NightAbility<"role_check">,
  isCurrent: () => boolean,
): void {
  if (!isCurrent()) return;
  recordRoleInspectionNightCommit(world, day, isCurrent);
  const role = world.getComponent(actorId, COMPONENT.Role),
    state = role && getGargoyleState(role),
    life = world.getComponent(actorId, COMPONENT.Alive),
    version = life && aliveLifeVersion(life);
  if (
    roleInspectionPolicy(ability.state) !== "gargoyle" ||
    role?.role !== Role.Gargoyle ||
    !state ||
    !life?.alive ||
    version === undefined ||
    ability.source.kind !== "native" ||
    ability.source.role !== Role.Gargoyle
  )
    return;
  beginRoleInspectionNight(world, day);
  nights.get(world)!.completed.set(role, {
    actorId,
    role,
    privateState: role.privateState,
    state,
    ability,
    abilityId: ability.id,
    activation: ability.activation,
    inspection: ability.state,
    inspectionPolicy: ability.state.inspectionPolicy,
    life,
    version,
    isCurrent,
  });
}
export function completedGargoyleInspection(world: World, role: RoleComponent): boolean {
  const scope = nights.get(world)?.completed.get(role);
  if (
    !scope ||
    !scope.isCurrent() ||
    role.privateState !== scope.privateState ||
    getGargoyleState(role) !== scope.state ||
    role.role !== Role.Gargoyle ||
    scope.ability.id !== scope.abilityId ||
    scope.ability.activation !== scope.activation ||
    findNightAbility(role, "role_check", scope.abilityId) !== scope.ability ||
    scope.ability.source.kind !== "native" ||
    scope.ability.source.role !== Role.Gargoyle ||
    scope.ability.disabled ||
    scope.ability.state !== scope.inspection ||
    scope.inspection.inspectionPolicy !== scope.inspectionPolicy ||
    roleInspectionPolicy(scope.inspection) !== "gargoyle"
  )
    return false;
  return (
    world.getComponent(scope.actorId, COMPONENT.Role) === role &&
    world.getComponent(scope.actorId, COMPONENT.Alive) === scope.life &&
    scope.life.alive &&
    aliveLifeVersion(scope.life) === scope.version
  );
}
