/**
 * 负责觉醒隐狼的学习模板、所属槽安装、激活／技能资源提交和玩家投影。输入为原角色、状态与实际夜；
 * 输出保留激活、技能和原存储引用，公开 DTO 类型独立归公共契约。
 * 只写 awakened_hidden_wolf 及其学习资源，不扩大角色容器写权、重抽模板、退款或授予请求许可。
 * 激活与主动技能生效夜分别保存；次数／关窗和字段提交保持原顺序，失败保留已写前缀。
 */
import type {
  AwakenedSkill,
  AwakenedActiveSkill,
  AwakenedTemplateRole,
  AwakenedLearning,
  AwakenedState,
  AwakenedReadSkill,
  AwakenedReadActiveSkill,
  AwakenedReadLearning,
  AwakenedReadState,
} from "@ai-werewolf-arena/game-contract";

import type { PlayerAwakenedState } from "@ai-werewolf-arena/game-contract/player-state-views";
import type { RoleId } from "@ai-werewolf-arena/game-catalog";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "../../../../core/domain/identity";
import { copyAbilityData } from "../abilities";

const validDay = (day: number) =>
  Number.isSafeInteger(day) && day >= 1 && day < Number.MAX_SAFE_INTEGER;
const validTarget = (id: number) => Number.isSafeInteger(id) && id >= 1;
export function freshAwakenedState(): AwakenedState {
  return {
    learned: null,
    mimicClosedDay: null,
    skillClosedDay: null,
    hasInheritedKnife: false,
    firstKnifeNight: null,
  };
}
export function getAwakenedState(role: RoleComponent | undefined): AwakenedReadState | undefined {
  return (
    role as { readonly privateState: { readonly awakened_hidden_wolf?: unknown } } | undefined
  )?.privateState.awakened_hidden_wolf as AwakenedReadState | undefined;
}
/** 复制数据后安装到原私有槽；请求许可和原体证明另有所有者，不随此数据复制。 */
export function setAwakenedState(role: RoleComponent, state: AwakenedState): AwakenedReadState {
  const owned = copyAbilityData(state);
  (role.privateState as { awakened_hidden_wolf: AwakenedState }).awakened_hidden_wolf = owned;
  return owned;
}

export function awakenedLearning(targetId: EntityId, role: RoleId, day: number): AwakenedLearning {
  if (!validDay(day) || !validTarget(targetId)) throw new Error("awakened_learning_input_invalid");
  let skill: AwakenedSkill;
  switch (role) {
    case "villager":
      skill = { kind: "villager" };
      break;
    case "mirror_girl":
      skill = { kind: "inspection", abilityId: null };
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
      throw new Error("awakened_learning_role_not_supported");
  }
  return { targetId, role, day, activationNight: null, activeFromNight: null, skill };
}
export function canAwakenedMimic(state: AwakenedReadState, day: number): boolean {
  return (
    validDay(day) &&
    state.learned === null &&
    (state.mimicClosedDay === null || state.mimicClosedDay < day)
  );
}
export function closeAwakenedMimic(state: AwakenedReadState, day: number): boolean {
  if (!canAwakenedMimic(state, day)) return false;
  (state as { mimicClosedDay: number | null }).mimicClosedDay = day;
  return true;
}
export function learnAwakenedRole(
  state: AwakenedReadState,
  targetId: EntityId,
  role: RoleId,
  day: number,
): boolean {
  if (!canAwakenedMimic(state, day)) return false;
  const learned = awakenedLearning(targetId, role, day);
  (state as { learned: AwakenedReadState["learned"] }).learned = learned;
  (state as { mimicClosedDay: number | null }).mimicClosedDay = day;
  return true;
}

/** 只在实际夜末提交激活；选择模板或进入以后日次不会补造激活夜。 */
export function activateAwakenedLearning(
  state: AwakenedReadState,
  night: number,
  mirrorAbilityId?: string,
): boolean {
  const learned = state.learned;
  if (!learned || !validDay(night) || night < learned.day || learned.activationNight !== null)
    return false;
  if (
    learned.skill.kind === "inspection" &&
    (typeof mirrorAbilityId !== "string" || !mirrorAbilityId.length)
  )
    return false;
  if (learned.skill.kind !== "inspection" && mirrorAbilityId !== undefined) return false;
  if (learned.skill.kind === "inspection")
    (learned.skill as { abilityId: string | null }).abilityId = mirrorAbilityId!;
  if (learned.skill.kind === "hunter") (learned.skill as { armed: boolean }).armed = true;
  (learned as { activationNight: number | null }).activationNight = night;
  (learned as { activeFromNight: number | null }).activeFromNight = night + 1;
  return true;
}

/** 被动猎人枪的可用性从枪自身读取；主动技能要在实际激活后的生效夜查询。 */
export function awakenedSkillForNight(
  state: AwakenedReadState,
  night: number,
): AwakenedReadActiveSkill | undefined {
  const learned = state.learned;
  if (
    !validDay(night) ||
    !learned ||
    learned.activationNight === null ||
    learned.activeFromNight === null ||
    night < learned.activeFromNight ||
    (state.skillClosedDay !== null && state.skillClosedDay >= night)
  )
    return undefined;
  if (learned.skill.kind === "poison" && learned.skill.remaining === 0) return undefined;
  if (learned.skill.kind === "wolf" && learned.skill.extraKnife === "spent") return undefined;
  return learned.skill.kind === "poison" ||
    learned.skill.kind === "guard" ||
    learned.skill.kind === "wolf"
    ? learned.skill
    : undefined;
}
export function closeAwakenedSkill(state: AwakenedReadState, night: number): boolean {
  if (!awakenedSkillForNight(state, night)) return false;
  (state as { skillClosedDay: number | null }).skillClosedDay = night;
  return true;
}

/** 装配／死亡检查点一次提交继承；它不依赖学习或技能选择，不消费学习资源。 */
export function recordAwakenedInheritance(state: AwakenedReadState, day: number): boolean {
  if (!validDay(day) || state.hasInheritedKnife) return false;
  (state as { hasInheritedKnife: boolean }).hasInheritedKnife = true;
  (state as { firstKnifeNight: number | null }).firstKnifeNight = Math.max(2, day + 1);
  return true;
}
export function awakenedKnifeReady(state: AwakenedReadState, night: number): boolean {
  return (
    validDay(night) &&
    state.hasInheritedKnife &&
    state.firstKnifeNight !== null &&
    night >= state.firstKnifeNight
  );
}
/** 调用方还核对当前原持有者与唯一活狼许可；这里的字段条件不单独授予刀权。 */
export function canAwakenedExtraKnife(state: AwakenedReadState, night: number): boolean {
  const skill = awakenedSkillForNight(state, night);
  return (
    awakenedKnifeReady(state, night) && skill?.kind === "wolf" && skill.extraKnife === "available"
  );
}
/** 空刀只关闭本夜机会；实际非空攻击才花费整局一次的额外刀库存。 */
export function chooseAwakenedAttack(
  state: AwakenedReadState,
  targetId: EntityId | null,
  night: number,
): boolean {
  if (!canAwakenedExtraKnife(state, night) || (targetId !== null && !validTarget(targetId)))
    return false;
  const skill = state.learned!.skill;
  if (skill.kind !== "wolf") return false;
  if (targetId !== null) (skill as { extraKnife: "available" | "spent" }).extraKnife = "spent";
  (state as { skillClosedDay: number | null }).skillClosedDay = night;
  return true;
}

export function chooseAwakenedGuard(
  state: AwakenedReadState,
  targetId: EntityId | null,
  night: number,
): boolean {
  const skill = awakenedSkillForNight(state, night);
  if (
    skill?.kind !== "guard" ||
    (targetId !== null && !validTarget(targetId)) ||
    (targetId !== null && skill.lastTarget === targetId && skill.lastGuardDay === night - 1)
  )
    return false;
  (skill as { lastTarget: EntityId | null }).lastTarget = targetId;
  (skill as { lastGuardDay: number | null }).lastGuardDay = night;
  (state as { skillClosedDay: number | null }).skillClosedDay = night;
  return true;
}
/** 合法的无工具等待也按空目标结束本夜守护，打断连续守同一编号的历史。 */
export function skipAwakenedSkill(state: AwakenedReadState, night: number): boolean {
  const skill = awakenedSkillForNight(state, night);
  if (!skill) return false;
  if (skill.kind === "guard") return chooseAwakenedGuard(state, null, night);
  if (skill.kind === "wolf") return chooseAwakenedAttack(state, null, night);
  return closeAwakenedSkill(state, night);
}
export function useAwakenedPoison(state: AwakenedReadState, night: number): boolean {
  const skill = awakenedSkillForNight(state, night);
  if (skill?.kind !== "poison" || skill.remaining !== 1) return false;
  (skill as { remaining: 0 | 1 }).remaining = 0;
  (state as { skillClosedDay: number | null }).skillClosedDay = night;
  return true;
}

/** 只投影列出的玩家字段；魔镜查验历史与库存由其能力实例唯一拥有，不复制进学习模板。 */
export function projectAwakenedState(state: AwakenedReadState): PlayerAwakenedState {
  const learned = state.learned;
  let skill: AwakenedSkill | undefined;
  if (learned)
    switch (learned.skill.kind) {
      case "villager":
        skill = { kind: "villager" };
        break;
      case "inspection":
        skill = { kind: "inspection", abilityId: learned.skill.abilityId };
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
        skill = { kind: "hunter", armed: learned.skill.armed, canShoot: learned.skill.canShoot };
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
            activationNight: learned.activationNight,
            activeFromNight: learned.activeFromNight,
            skill,
          }
        : null,
    mimicClosedDay: state.mimicClosedDay,
    skillClosedDay: state.skillClosedDay,
    hasInheritedKnife: state.hasInheritedKnife,
    firstKnifeNight: state.firstKnifeNight,
  };
}
