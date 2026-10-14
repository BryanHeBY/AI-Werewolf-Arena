/**
 * 负责觉醒隐狼本夜原体、学习与镜像范围捕获；输入保原能力／Role／生命引用，输出为复验与本夜记录。
 * 原阵营表达式晚查当前值，不新增 Camp 引用撤权；槽／来源／生命替换仍按原规则失效。
 * 已付 skill／mirror 原谓词不因行动墓碑失效；不以合法数据副本授予原捕获权限。
 */
import type {
  AwakenedReadState as AwakenedState,
  AwakenedReadActiveSkill as AwakenedActiveSkill,
} from "@ai-werewolf-arena/game-contract";

import { aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role, type EntityId } from "../../../../core/domain/model";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";
import { isRoleExecutionRetired } from "../../../../core/domain/role-execution-authority";
import { awakenedSkillForNight, getAwakenedState } from "./state";
import { findNightAbility, type NightAbilityReadView } from "../abilities";

export interface AwakenedOwnerScope {
  readonly world: World;
  readonly actorId: EntityId;
  readonly role: RoleComponent;
  readonly state: AwakenedState;
  readonly life: NightLifeScope;
  isCurrent(allowFirstDeath?: boolean): boolean;
  /** 仅未付执行的拒绝条件；调用方仍按原序检查当前性、阶段、资源和目标。 */
  canAct(): boolean;
}
export function captureAwakenedOwner(
  world: World,
  actorId: EntityId,
  phaseCurrent: () => boolean,
): AwakenedOwnerScope | null {
  const role = world.getComponent(actorId, COMPONENT.Role),
    state = getAwakenedState(role),
    life = captureNightLife(world, actorId);
  if (
    !phaseCurrent() ||
    !role ||
    role.role !== Role.AwakenedHiddenWolf ||
    world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Wolf ||
    !state ||
    !life
  )
    return null;
  const privateState = role.privateState;
  return {
    world,
    actorId,
    role,
    state,
    life,
    // 捕获原 Role，只读永久退休状态；不查 World／Camp，不污染已付 isCurrent。
    canAct: () => !isRoleExecutionRetired(role),
    isCurrent: (allowFirstDeath = false) => {
      const original =
        world.getComponent(actorId, COMPONENT.Alive) === life.life &&
        aliveLifeVersion(life.life) ===
          life.version + (allowFirstDeath && !life.life.alive ? 1 : 0);
      return (
        phaseCurrent() &&
        world.getComponent(actorId, COMPONENT.Role) === role &&
        role.role === Role.AwakenedHiddenWolf &&
        world.getComponent(actorId, COMPONENT.Camp)?.camp === Camp.Wolf &&
        role.privateState === privateState &&
        getAwakenedState(role) === state &&
        original &&
        (allowFirstDeath || life.life.alive)
      );
    },
  };
}
/** 绑定已付事实，复验原学习引用，不读已关闭槽或已消费瓶／刀来取消效果。 */
export function bindAwakenedSkill(
  owner: AwakenedOwnerScope,
  day: number,
): { readonly skill: AwakenedActiveSkill; isCurrent(allowFirstDeath?: boolean): boolean } | null {
  const learned = owner.state.learned,
    skill = awakenedSkillForNight(owner.state, day);
  if (
    !owner.isCurrent() ||
    !learned ||
    !skill ||
    learned.activationNight === null ||
    learned.activeFromNight === null
  )
    return null;
  const { targetId, role, day: learnedDay, activationNight, activeFromNight } = learned,
    kind = skill.kind;
  return {
    skill,
    isCurrent: (allowFirstDeath = false) =>
      owner.isCurrent(allowFirstDeath) &&
      owner.state.learned === learned &&
      learned.skill === skill &&
      skill.kind === kind &&
      learned.targetId === targetId &&
      learned.role === role &&
      learned.day === learnedDay &&
      learned.activationNight === activationNight &&
      learned.activeFromNight === activeFromNight,
  };
}
/** 仅觉醒原生镜像依赖本学习；独立赠予／复制实例不附加这项来源关系。 */
export function captureAwakenedMirrorScope(
  world: World,
  actorId: EntityId,
  ability: NightAbilityReadView<"role_check">,
  day: number,
  phaseCurrent: () => boolean,
): (() => boolean) | null {
  const owner = captureAwakenedOwner(world, actorId, phaseCurrent),
    learned = owner?.state.learned,
    skill = learned?.skill;
  if (
    !owner ||
    currentAwakenedNight(world, owner.role) !== day ||
    !learned ||
    learned.role !== Role.MirrorGirl ||
    learned.activationNight === null ||
    learned.activeFromNight === null ||
    day < learned.activeFromNight ||
    skill?.kind !== "inspection" ||
    skill.abilityId !== ability.id
  )
    return null;
  const { targetId, role, day: learnedDay, activationNight, activeFromNight } = learned,
    abilityId = skill.abilityId;
  return () =>
    owner.isCurrent() &&
    currentAwakenedNight(world, owner.role) === day &&
    owner.state.learned === learned &&
    learned.skill === skill &&
    skill.kind === "inspection" &&
    skill.abilityId === abilityId &&
    learned.targetId === targetId &&
    learned.role === role &&
    learned.day === learnedDay &&
    learned.activationNight === activationNight &&
    learned.activeFromNight === activeFromNight &&
    findNightAbility(owner.role, "role_check", abilityId) === ability;
}
const nights = new WeakMap<
  World,
  { day: number; owners: Map<RoleComponent, AwakenedOwnerScope> }
>();
const committed = new WeakMap<World, Set<number>>();
export function beginAwakenedNight(
  world: World,
  day: number,
  owners: readonly AwakenedOwnerScope[],
): void {
  if (hasAwakenedNightCommit(world, day)) throw new Error("awakened_night_reentry_after_commit");
  if (nights.get(world)?.day === day) throw new Error("awakened_night_reentry_after_commit");
  if ((nights.get(world)?.day ?? day) > day) throw new Error("awakened_night_clock_regressed");
  // 开夜建立新执行范围；原原体复验之后拒绝退休者，历史提交与已付查询仍不附加此条件。
  const currentOwners = owners.filter((owner) => owner.world === world && owner.isCurrent() && owner.canAct());
  nights.set(world, { day, owners: new Map(currentOwners.map((owner) => [owner.role, owner])) });
  // 建立本夜原体 authority 本身就是已提交前缀；仅继承刀或没有复制主动技能的夜也保此记录。
  if (currentOwners.length) recordAwakenedNightCommit(world, day);
}
export function currentAwakenedNight(world: World, role: RoleComponent): number | null {
  const night = nights.get(world),
    owner = night?.owners.get(role);
  return night && owner?.isCurrent() && livingNightLife(world, owner.life) ? night.day : null;
}
export function recordAwakenedNightCommit(world: World, day: number): void {
  const days = committed.get(world) ?? new Set<number>();
  days.add(day);
  committed.set(world, days);
}
export function hasAwakenedNightCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}
