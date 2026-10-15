/**
 * 负责查验目标原体捕获与狐狸查验提案提交；输入保目标生命／Role引用和来源当前性。
 * 阵营晚查当前值，同值 Camp 替换不加引用撤权；输出保原记账与延期提案，知识发表不标死。
 * 原已付 owner／目标谓词不消费行动墓碑，不因剩余资源已经消费而取消提案。
 */
import { COMPONENT, Role, Camp, type RoleComponent, type World } from "../../../../domain";
import { livingNightLife, type NightLifeScope } from "../../../../domain/night-effects";
import type { NightStageState } from "../../stages/night/contracts";
const committed = new WeakMap<World, Set<number>>();
export function hasFoxInspectionNightCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}
/** 等待前捕获原引用和值；新角色／生命不能取得旧待提交查验。 */
export function captureInspectionIdentity(world: World, target: NightLifeScope) {
  const role = world.getComponent(target.id, COMPONENT.Role);
  const kind = role?.role,
    camp = role == null ? undefined : world.getComponent(target.id, COMPONENT.Camp)?.camp,
    state = role?.privateState;
  return {
    role,
    isCurrent: () =>
      livingNightLife(world, target) &&
      world.getComponent(target.id, COMPONENT.Role) === role &&
      role?.role === kind &&
      (role == null ? undefined : world.getComponent(target.id, COMPONENT.Camp)?.camp) === camp &&
      role?.privateState === state,
  };
}
/** 仅已提交 Seer 类动作调用；只读／身份查验不提交狐狸致死关系。 */
export function commitFoxInspection(
  world: World,
  state: NightStageState,
  target: NightLifeScope,
  day: number,
  ownerCurrent: () => boolean,
): void {
  const identity = captureInspectionIdentity(world, target);
  if (identity.role?.role !== Role.CursedFox || world.getComponent(target.id, COMPONENT.Camp)?.camp !== Camp.ThirdParty) return;
  (state.foxInspections ??= []).push({
    target,
    isTargetCurrent: identity.isCurrent,
    isCurrent: () => ownerCurrent() && identity.isCurrent(),
  });
  const days = committed.get(world) ?? new Set<number>();
  days.add(day);
  committed.set(world, days);
}
