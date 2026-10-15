/**
 * 负责机械狼原体、复制技能与已选模式范围，输入保原生命／槽／来源，输出为复验和实际本夜提交记录。
 * 原阵营表达式晚查当前值，不新增 Camp 引用撤权；替换模式／槽仍不能复用原学习或刀权。
 * 已付技能谓词保原资源独立性，不将行动退休混入原体复验或删除知识数据。
 */
import type {
  MechanicalMode,
  MechanicalReadState as MechanicalState,
  MechanicalReadSkill as MechanicalSkill,
} from "@ai-werewolf-arena/game-contract";

import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { Camp, Role, type EntityId } from "../../domain/model";
import { captureNightLife, livingNightLife, type NightLifeScope } from "../../domain/night-effects";
import type { World } from "../../domain/world";
import { isRoleExecutionRetired } from "../../domain/role-execution-authority";
import { getMechanicalState } from "./state";

export interface MechanicalOwnerScope {
  readonly world: World;
  readonly actorId: EntityId;
  readonly role: RoleComponent;
  readonly state: MechanicalState;
  readonly life: NightLifeScope;
  isCurrent(): boolean;
  /** 仅未付执行的拒绝条件；调用方仍按原序检查当前性、阶段、资源和目标。 */
  canAct(): boolean;
}

/** 仅运行引用，不序列化进玩家 DTO 或 Tape，也不是状态副本的授权。 */
export function captureMechanicalOwner(
  world: World,
  actorId: EntityId,
  phaseCurrent: () => boolean,
): MechanicalOwnerScope | null {
  const role = world.getComponent(actorId, COMPONENT.Role);
  const state = getMechanicalState(role);
  const life = captureNightLife(world, actorId);
  if (
    !phaseCurrent() ||
    !role ||
    role.role !== Role.MechanicalWolf ||
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
    isCurrent: () =>
      phaseCurrent() &&
      world.getComponent(actorId, COMPONENT.Role) === role &&
      role.role === Role.MechanicalWolf &&
      world.getComponent(actorId, COMPONENT.Camp)?.camp === Camp.Wolf &&
      role.privateState === privateState &&
      getMechanicalState(role) === state &&
      livingNightLife(world, life),
  };
}

/** 已提交效果绑定原学习和所选模式；不按已经消费的库存取消效果。 */
export function bindMechanicalSkill(
  scope: MechanicalOwnerScope,
  day: number,
): {
  readonly skill: MechanicalSkill;
  isCurrent(): boolean;
} | null {
  const learned = scope.state.learned,
    mode = scope.state.mode;
  if (
    day < 2 ||
    !scope.isCurrent() ||
    !hasCurrentMechanicalMode(scope.world, scope.role, "skill") ||
    !learned ||
    learned.readyOnNight > day ||
    !mode ||
    mode.day !== day ||
    mode.kind !== "skill"
  )
    return null;
  const skill = learned.skill,
    kind = skill.kind;
  return {
    skill,
    isCurrent: () =>
      scope.isCurrent() &&
      hasCurrentMechanicalMode(scope.world, scope.role, "skill") &&
      scope.state.learned === learned &&
      learned.skill === skill &&
      skill.kind === kind &&
      scope.state.mode === mode &&
      mode.day === day &&
      mode.kind === "skill" &&
      learned.readyOnNight <= day,
  };
}

interface MechanicalModeScope {
  readonly owner: MechanicalOwnerScope;
  readonly mode: NonNullable<MechanicalState["mode"]>;
  readonly kind: MechanicalMode;
}
const modes = new WeakMap<
  World,
  { readonly day: number; readonly actors: Map<EntityId, MechanicalModeScope> }
>();
const committed = new WeakMap<World, Set<number>>();
export function hasMechanicalNightCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}
export function recordMechanicalNightCommit(world: World, day: number): void {
  const days = committed.get(world) ?? new Set<number>();
  days.add(day);
  committed.set(world, days);
}

/** 接受模式选择或原明确 skill 默认后才保存本夜 authority，失败不重建旧范围。 */
export function recordMechanicalModeScope(
  world: World,
  scope: MechanicalOwnerScope,
  day: number,
): boolean {
  const mode = scope.state.mode;
  if (scope.world !== world || day < 2 || !scope.isCurrent() || !mode || mode.day !== day)
    return false;
  let night = modes.get(world);
  if (night && night.day > day) return false;
  if (!night || night.day !== day) {
    night = { day, actors: new Map() };
    modes.set(world, night);
  }
  if (night.actors.has(scope.actorId)) return false;
  night.actors.set(scope.actorId, { owner: scope, mode, kind: mode.kind });
  return true;
}

/** 只读刀权查询；序列化模式事实不能恢复已经失效的原 authority。 */
export function hasCurrentMechanicalMode(
  world: World,
  role: RoleComponent,
  expectedKind: MechanicalMode,
): boolean {
  const night = modes.get(world);
  if (!night) return false;
  for (const { owner, mode, kind } of night.actors.values()) {
    if (
      owner.role === role &&
      owner.isCurrent() &&
      owner.state.mode === mode &&
      mode.day === night.day &&
      mode.kind === kind &&
      kind === expectedKind
    )
      return true;
  }
  return false;
}
export function hasCurrentMechanicalKillMode(world: World, role: RoleComponent): boolean {
  return hasCurrentMechanicalMode(world, role, "kill");
}
