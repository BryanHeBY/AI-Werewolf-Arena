/**
 * Owns Mechanical Wolf's learned-skill state data, copied installation and projections.
 * Inputs are the original role or learned state; outputs retain the same declared
 * learning/mode/knife fields and selected stored reference. The installer alone
 * restores the mechanical_wolf slot at its original write; inherited resource,
 * phase and receipt checks remain separate. No container copy or parser is added.
 * Pure payload/read data structures belong to the neutral role-state data owner;
 * this leaf retains original live references and concrete installation/commit operations.
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

import type { PlayerMechanicalState } from "../player_extended_state";
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
/** One owner for all native mechanical facts and consumable resources. */
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

/** Only the assembly/death owner calls this after a full actual death proposal. */
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

/** A legal wait closes this night's opportunity without spending the once-per-game learning. */
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

/** Entering an actual night arms passive guns and expires an elapsed first-knife window. */
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

/** Passing uses the same skill-mode choice; accepting a second choice never changes it. */
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

/** Caller additionally verifies live sole-Wolf ownership and the scoped mode choice. */
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

/** Consecutive IDs are compared across actual night numbers, even if a target has revived. */
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

/** Explicit player projection: future God-only debug fields must not become player input. */
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

/** Caller retains inspection/currentness checks; history lookup precedes target.id. */
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
/** Payment follows the original poison claims and marks, without an extra check. */
export function consumeMechanicalPoison(
  skill: Extract<MechanicalReadSkill, { kind: "poison" }>,
): void {
  (skill as { remaining: 0 | 1 }).remaining = 0;
}
/** Caller retains the original attack's nullable target and completion ordering. */
export function closeMechanicalExtraKnife(
  skill: Extract<MechanicalReadSkill, { kind: "wolf" }>,
  target: unknown,
): void {
  (skill as { extraKnife: "available" | "spent" | "expired" }).extraKnife = target
    ? "spent"
    : "expired";
}
