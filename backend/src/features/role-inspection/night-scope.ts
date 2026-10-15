/**
 * 负责角色查验本夜提交和可选完成回执。输入为原 World、实际夜晚、石像鬼／查验完成选择；
 * 输出为每夜记账及已完成目标知识，不创建活跃能力或第二查验资源。状态族检查同 payload
 * 引用和政策；此 owner 仍在原顺序检查角色、生命版本、id、来源、激活、禁用及阶段当前性，
 * 替换或过期后不借合法 payload 恢复原回执。
 */
import { roleInspectionPolicy } from "@ai-werewolf-arena/game-contract/role-inspection-policy";
import type { GargoyleReadState as GargoyleState } from "@ai-werewolf-arena/game-contract";

import type { RoleInspectionReadState } from "@ai-werewolf-arena/game-contract";

import { aliveLifeVersion, type AliveComponent } from "../../domain/components/alive";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { Role } from "../../domain/model";
import type { World } from "../../domain/world";
import { findNightAbility, type NightAbilityReadView } from "../night-abilities/inventory-ports";
import { getGargoyleState } from "../gargoyle/ports";

import { ROLE_INSPECTION_STATE_SLOT } from "./state-slot";

interface Completion {
  actorId: number;
  role: RoleComponent;
  privateState: RoleComponent["privateState"];
  state: GargoyleState;
  ability: NightAbilityReadView<"role_check">;
  abilityId: string;
  activation: NightAbilityReadView["activation"];
  inspection: RoleInspectionReadState;
  inspectionPolicy: RoleInspectionReadState["inspectionPolicy"];
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
  ability: NightAbilityReadView<"role_check">,
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
    ROLE_INSPECTION_STATE_SLOT.invalidations.payloadChanged(scope)
  )
    return false;
  return (
    world.getComponent(scope.actorId, COMPONENT.Role) === role &&
    world.getComponent(scope.actorId, COMPONENT.Alive) === scope.life &&
    scope.life.alive &&
    aliveLifeVersion(scope.life) === scope.version
  );
}
