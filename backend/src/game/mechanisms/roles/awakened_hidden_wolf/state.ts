import type { PlayerAwakenedState } from "../player_extended_state";
import type { RoleId } from "@ai-werewolf-arena/game-catalog";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "../../../../core/domain/identity";
import { copyAbilityData } from "../abilities";

export type AwakenedSkill =
  | { kind: "villager" }
  | { kind: "inspection"; abilityId: string | null }
  | { kind: "poison"; remaining: 0 | 1 }
  | { kind: "guard"; lastTarget: EntityId | null; lastGuardDay: number | null }
  | { kind: "hunter"; canShoot: boolean; armed: boolean }
  | { kind: "wolf"; extraKnife: "available" | "spent" };
export type AwakenedActiveSkill = Extract<AwakenedSkill, { kind: "poison" | "guard" | "wolf" }>;
export type AwakenedTemplateRole = Extract<
  RoleId,
  "villager" | "mirror_girl" | "witch" | "guard" | "hunter" | "wolf"
>;
export interface AwakenedLearning {
  readonly targetId: EntityId;
  readonly role: AwakenedTemplateRole;
  readonly day: number;
  activationNight: number | null;
  activeFromNight: number | null;
  readonly skill: AwakenedSkill;
}
export interface AwakenedState {
  learned: AwakenedLearning | null;
  mimicClosedDay: number | null;
  skillClosedDay: number | null;
  hasInheritedKnife: boolean;
  firstKnifeNight: number | null;
}

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
export function getAwakenedState(role: RoleComponent | undefined): AwakenedState | undefined {
  return role?.privateState.awakened_hidden_wolf as AwakenedState | undefined;
}
/** Persist semantic facts only; references and night authorization live outside this object. */
export function setAwakenedState(role: RoleComponent, state: AwakenedState): AwakenedState {
  const owned = copyAbilityData(state);
  role.privateState.awakened_hidden_wolf = owned;
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
export function canAwakenedMimic(state: AwakenedState, day: number): boolean {
  return (
    validDay(day) &&
    state.learned === null &&
    (state.mimicClosedDay === null || state.mimicClosedDay < day)
  );
}
export function closeAwakenedMimic(state: AwakenedState, day: number): boolean {
  if (!canAwakenedMimic(state, day)) return false;
  state.mimicClosedDay = day;
  return true;
}
export function learnAwakenedRole(
  state: AwakenedState,
  targetId: EntityId,
  role: RoleId,
  day: number,
): boolean {
  if (!canAwakenedMimic(state, day)) return false;
  const learned = awakenedLearning(targetId, role, day);
  state.learned = learned;
  state.mimicClosedDay = day;
  return true;
}

/** Called at the actual night-end commit, never when selecting a template or entering a later night. */
export function activateAwakenedLearning(
  state: AwakenedState,
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
  if (learned.skill.kind === "inspection") learned.skill.abilityId = mirrorAbilityId!;
  if (learned.skill.kind === "hunter") learned.skill.armed = true;
  learned.activationNight = night;
  learned.activeFromNight = night + 1;
  return true;
}

/** Passive Hunter readiness is read from its gun; active skills begin after the actual activation night. */
export function awakenedSkillForNight(
  state: AwakenedState,
  night: number,
): AwakenedActiveSkill | undefined {
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
export function closeAwakenedSkill(state: AwakenedState, night: number): boolean {
  if (!awakenedSkillForNight(state, night)) return false;
  state.skillClosedDay = night;
  return true;
}

/** The assembly/death owner commits inheritance once, independent of learning or skill selection. */
export function recordAwakenedInheritance(state: AwakenedState, day: number): boolean {
  if (!validDay(day) || state.hasInheritedKnife) return false;
  state.hasInheritedKnife = true;
  state.firstKnifeNight = Math.max(2, day + 1);
  return true;
}
export function awakenedKnifeReady(state: AwakenedState, night: number): boolean {
  return (
    validDay(night) &&
    state.hasInheritedKnife &&
    state.firstKnifeNight !== null &&
    night >= state.firstKnifeNight
  );
}
/** The caller additionally checks current original-owner and sole-living-Wolf permission. */
export function canAwakenedExtraKnife(state: AwakenedState, night: number): boolean {
  const skill = awakenedSkillForNight(state, night);
  return (
    awakenedKnifeReady(state, night) && skill?.kind === "wolf" && skill.extraKnife === "available"
  );
}
/** Passing closes only this night. A real nonempty attack spends the once-per-game stock. */
export function chooseAwakenedAttack(
  state: AwakenedState,
  targetId: EntityId | null,
  night: number,
): boolean {
  if (!canAwakenedExtraKnife(state, night) || (targetId !== null && !validTarget(targetId)))
    return false;
  const skill = state.learned!.skill;
  if (skill.kind !== "wolf") return false;
  if (targetId !== null) skill.extraKnife = "spent";
  state.skillClosedDay = night;
  return true;
}

export function chooseAwakenedGuard(
  state: AwakenedState,
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
  skill.lastTarget = targetId;
  skill.lastGuardDay = night;
  state.skillClosedDay = night;
  return true;
}
/** A legal tool-free wait also breaks consecutive guarding. */
export function skipAwakenedSkill(state: AwakenedState, night: number): boolean {
  const skill = awakenedSkillForNight(state, night);
  if (!skill) return false;
  if (skill.kind === "guard") return chooseAwakenedGuard(state, null, night);
  if (skill.kind === "wolf") return chooseAwakenedAttack(state, null, night);
  return closeAwakenedSkill(state, night);
}
export function useAwakenedPoison(state: AwakenedState, night: number): boolean {
  const skill = awakenedSkillForNight(state, night);
  if (skill?.kind !== "poison" || skill.remaining !== 1) return false;
  skill.remaining = 0;
  state.skillClosedDay = night;
  return true;
}

/** Known-field projection; Mirror history and inventory belong solely to its ability instance. */
export function projectAwakenedState(state: AwakenedState): PlayerAwakenedState {
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
