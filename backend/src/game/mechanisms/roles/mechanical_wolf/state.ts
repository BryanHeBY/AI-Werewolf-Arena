/**
 * 负责机械狼的学习模板、所属槽安装、模式／刀资源提交和玩家投影。输入为原角色、状态与日次；
 * 输出保留原学习、模式、刀权字段以及存储引用，公开 DTO 类型独立归公共契约。
 * 模板创建不克隆其他玩家库存；本模块只写 mechanical_wolf 及其资源，不替换角色容器或授予请求许可。
 * 实际开夜才武装枪和处理首刀过期；提交按原字段顺序，异常不回滚此前状态。
 */
import type {
  MechanicalMode,
  MechanicalSkill,
  MechanicalLearning,
  MechanicalState,
  MechanicalReadSkill,
  MechanicalReadLearning,
  MechanicalReadState,
} from "@ai-werewolf-arena/game-contract";

import type { PlayerMechanicalState } from "@ai-werewolf-arena/game-contract/player-state-views";
import type { InspectionResult, RoleId } from "@ai-werewolf-arena/game-catalog";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "../../../../core/domain/identity";
import { copyAbilityData } from "../abilities";

export function freshMechanicalState(): MechanicalState {
  return {
    learned: null,
    mimicClosedDay: null,
    mode: null,
    hasInheritedKnife: false,
    firstKnifeNight: null,
    skillClosedDay: null,
  };
}
/** 从所属槽返回原存储引用；类型只读不等于复制或运行时冻结，写入仍由具名提交函数负责。 */
export function getMechanicalState(
  role: RoleComponent | undefined,
): MechanicalReadState | undefined {
  return (role as { readonly privateState: { readonly mechanical_wolf?: unknown } } | undefined)
    ?.privateState.mechanical_wolf as MechanicalReadState | undefined;
}
export function setMechanicalState(
  role: RoleComponent,
  state: MechanicalState,
): MechanicalReadState {
  const owned = copyAbilityData(state);
  (role.privateState as { mechanical_wolf: MechanicalState }).mechanical_wolf = owned;
  return owned;
}
export function mechanicalLearning(
  targetId: EntityId,
  role: RoleId,
  day: number,
): MechanicalLearning {
  let skill: MechanicalSkill;
  switch (role) {
    case "villager":
      skill = { kind: "villager" };
      break;
    case "psychic":
      skill = { kind: "inspection", history: [] };
      break;
    case "witch":
      skill = { kind: "poison", remaining: 1 };
      break;
    case "guard":
      skill = { kind: "guard", lastTarget: null, lastGuardDay: null };
      break;
    case "hunter":
      skill = { kind: "hunter", canShoot: true, armed: false };
      break;
    case "wolf":
      skill = { kind: "wolf", extraKnife: "available" };
      break;
    default:
      throw new Error("mechanical_learning_role_not_supported");
  }
  return { targetId, role, day, readyOnNight: day + 1, skill };
}

/** 开局／死亡检查点调用此处一次提交继承字段；后续刀权资格和事实发布仍由原调用方负责。 */
export function recordMechanicalInheritance(state: MechanicalReadState, day: number): boolean {
  if (state.hasInheritedKnife) return false;
  (state as { hasInheritedKnife: boolean }).hasInheritedKnife = true;
  (state as { firstKnifeNight: number | null }).firstKnifeNight = Math.max(2, day + 1);
  return true;
}

export function canMechanicalMimic(state: MechanicalReadState, day: number): boolean {
  return (
    day >= 1 &&
    state.learned === null &&
    (state.mimicClosedDay === null || state.mimicClosedDay < day)
  );
}

/** 合法等待只关闭本夜学习机会，保留整局一次的学习库存。 */
export function closeMechanicalMimic(state: MechanicalReadState, day: number): boolean {
  if (!canMechanicalMimic(state, day)) return false;
  (state as { mimicClosedDay: number | null }).mimicClosedDay = day;
  return true;
}

export function learnMechanicalRole(
  state: MechanicalReadState,
  targetId: EntityId,
  role: RoleId,
  day: number,
): boolean {
  if (!canMechanicalMimic(state, day)) return false;
  const learned = mechanicalLearning(targetId, role, day);
  if (
    learned.skill.kind === "wolf" &&
    state.firstKnifeNight !== null &&
    day >= state.firstKnifeNight
  ) {
    (learned.skill as { extraKnife: "available" | "spent" | "expired" }).extraKnife = "expired";
  }
  (state as { learned: MechanicalReadState["learned"] }).learned = learned;
  (state as { mimicClosedDay: number | null }).mimicClosedDay = day;
  return true;
}

/** 进入实际夜才武装被动枪，并将已经过去的首刀窗口标为过期，不能靠日次跳转补刀。 */
export function advanceMechanicalNight(state: MechanicalReadState, day: number): void {
  const learned = state.learned;
  if (!learned) return;
  if (learned.skill.kind === "hunter" && day >= learned.readyOnNight)
    (learned.skill as { armed: boolean }).armed = true;
  if (
    learned.skill.kind === "wolf" &&
    learned.skill.extraKnife === "available" &&
    state.firstKnifeNight !== null &&
    day > state.firstKnifeNight
  ) {
    (learned.skill as { extraKnife: "available" | "spent" | "expired" }).extraKnife = "expired";
  }
}

export function canSelectMechanicalMode(state: MechanicalReadState, day: number): boolean {
  return day >= 2 && (state.mode === null || state.mode.day < day);
}

/** 等待沿用技能模式选择；本夜第二次选择被拒，不重写第一次模式。 */
export function selectMechanicalMode(
  state: MechanicalReadState,
  day: number,
  mode: MechanicalMode,
): boolean {
  if (!canSelectMechanicalMode(state, day)) return false;
  (state as { mode: MechanicalReadState["mode"] }).mode = { day, kind: mode };
  const learned = state.learned;
  if (
    mode === "skill" &&
    state.firstKnifeNight === day &&
    learned?.skill.kind === "wolf" &&
    learned.skill.extraKnife === "available"
  ) {
    (learned.skill as { extraKnife: "available" | "spent" | "expired" }).extraKnife = "expired";
  }
  return true;
}

export function mechanicalSkillForNight(
  state: MechanicalReadState,
  day: number,
): MechanicalReadSkill | undefined {
  if (
    day < 2 ||
    state.mode?.day !== day ||
    state.mode.kind !== "skill" ||
    !state.learned ||
    state.learned.readyOnNight > day ||
    (state.skillClosedDay !== null && state.skillClosedDay >= day)
  )
    return undefined;
  return state.learned.skill;
}

export function closeMechanicalSkill(state: MechanicalReadState, day: number): boolean {
  if (!mechanicalSkillForNight(state, day)) return false;
  (state as { skillClosedDay: number | null }).skillClosedDay = day;
  return true;
}

/** 调用方另行核对当前唯一活狼的刀权及原模式许可；本字段查询不授予出刀资格。 */
export function mechanicalKnifeSelected(state: MechanicalReadState, day: number): boolean {
  return (
    day >= 2 &&
    state.hasInheritedKnife &&
    state.firstKnifeNight !== null &&
    day >= state.firstKnifeNight &&
    state.mode?.day === day &&
    state.mode.kind === "kill"
  );
}

export function canMechanicalExtraKnife(state: MechanicalReadState, day: number): boolean {
  const learned = state.learned;
  return (
    mechanicalKnifeSelected(state, day) &&
    state.firstKnifeNight === day &&
    learned !== null &&
    learned.readyOnNight <= day &&
    learned.skill.kind === "wolf" &&
    learned.skill.extraKnife === "available"
  );
}

/** 按相邻实际夜与目标编号判重复守护，同编号复活不会清除该历史；两字段按原顺序写入。 */
export function chooseMechanicalGuard(
  skill: Extract<MechanicalReadSkill, { kind: "guard" }>,
  targetId: EntityId | null,
  day: number,
): { failed: boolean } {
  const failed =
    targetId !== null && skill.lastTarget === targetId && skill.lastGuardDay === day - 1;
  (skill as { lastTarget: EntityId | null }).lastTarget = targetId;
  (skill as { lastGuardDay: number | null }).lastGuardDay = day;
  return { failed };
}

/** 玩家投影逐字段列出知识和资源摘要；以后新增的全局调试字段不会自动成为玩家输入。 */
export function projectMechanicalState(state: MechanicalReadState): PlayerMechanicalState {
  const learned = state.learned;
  let skill: MechanicalSkill | undefined;
  if (learned)
    switch (learned.skill.kind) {
      case "villager":
        skill = { kind: "villager" };
        break;
      case "inspection":
        skill = {
          kind: "inspection",
          history: learned.skill.history.map((report) => ({
            day: report.day,
            targetId: report.targetId,
            result: { kind: "role", role: report.result.role },
          })),
        };
        break;
      case "poison":
        skill = { kind: "poison", remaining: learned.skill.remaining };
        break;
      case "guard":
        skill = {
          kind: "guard",
          lastTarget: learned.skill.lastTarget,
          lastGuardDay: learned.skill.lastGuardDay,
        };
        break;
      case "hunter":
        skill = { kind: "hunter", canShoot: learned.skill.canShoot, armed: learned.skill.armed };
        break;
      case "wolf":
        skill = { kind: "wolf", extraKnife: learned.skill.extraKnife };
        break;
    }
  return {
    learned:
      learned && skill
        ? {
            targetId: learned.targetId,
            role: learned.role,
            day: learned.day,
            readyOnNight: learned.readyOnNight,
            skill,
          }
        : null,
    mimicClosedDay: state.mimicClosedDay,
    mode: state.mode ? { day: state.mode.day, kind: state.mode.kind } : null,
    hasInheritedKnife: state.hasInheritedKnife,
    firstKnifeNight: state.firstKnifeNight,
    skillClosedDay: state.skillClosedDay,
  };
}

/** 调用方保留查验与当前性检查；先读取原历史容器，再读取 target.id 并追加一行。 */
export function recordMechanicalInspection(
  skill: Extract<MechanicalReadSkill, { kind: "inspection" }>,
  day: number,
  target: { readonly id: EntityId },
  result: Extract<InspectionResult, { kind: "role" }>,
): void {
  (skill.history as Extract<MechanicalSkill, { kind: "inspection" }>["history"]).push({
    day,
    targetId: target.id,
    result: { ...result },
  });
}
/** 原毒提案与标记之后提交库存消耗，不增加复检、回滚或新的付款时点。 */
export function consumeMechanicalPoison(
  skill: Extract<MechanicalReadSkill, { kind: "poison" }>,
): void {
  (skill as { remaining: 0 | 1 }).remaining = 0;
}
/** 调用方保留原攻击可空目标与完成顺序；非空目标标花费，空目标只按原机械首刀规则过期。 */
export function closeMechanicalExtraKnife(
  skill: Extract<MechanicalReadSkill, { kind: "wolf" }>,
  target: unknown,
): void {
  (skill as { extraKnife: "available" | "spent" | "expired" }).extraKnife = target
    ? "spent"
    : "expired";
}
