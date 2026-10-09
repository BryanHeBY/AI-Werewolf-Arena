import { expect, test } from "bun:test";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { Camp, Role } from "../../../src/core";
import {
  activateAwakenedLearning,
  awakenedKnifeReady,
  awakenedLearning,
  awakenedSkillForNight,
  canAwakenedExtraKnife,
  canAwakenedMimic,
  chooseAwakenedAttack,
  chooseAwakenedGuard,
  closeAwakenedMimic,
  closeAwakenedSkill,
  freshAwakenedState,
  getAwakenedState,
  learnAwakenedRole,
  projectAwakenedState,
  recordAwakenedInheritance,
  setAwakenedState,
  skipAwakenedSkill,
  useAwakenedPoison,
  type AwakenedTemplateRole,
} from "../../../src/game/mechanisms/roles/awakened_hidden_wolf/state";

const initialSkills = {
  villager: { kind: "villager" },
  mirror_girl: { kind: "inspection", abilityId: null },
  witch: { kind: "poison", remaining: 1 },
  guard: { kind: "guard", lastTarget: null, lastGuardDay: null },
  hunter: { kind: "hunter", canShoot: true, armed: false },
  wolf: { kind: "wolf", extraKnife: "available" },
} as const;
for (const role of Object.keys(initialSkills) as AwakenedTemplateRole[])
  test(`${role}: template identity is frozen immediately but skill activation has no guessed date`, () => {
    expect(awakenedLearning(7, role, 3)).toEqual({
      targetId: 7,
      role,
      day: 3,
      activationNight: null,
      activeFromNight: null,
      skill: initialSkills[role],
    });
  });

test("unsupported template does not spend learning or substitute a mechanical inspection skill", () => {
  for (const role of ["psychic", "seer", "awakened_hidden_wolf", "mechanical_wolf"] as const) {
    const state = freshAwakenedState();
    expect(() => learnAwakenedRole(state, 5, role, 1)).toThrow(
      "awakened_learning_role_not_supported",
    );
    expect(state).toEqual(freshAwakenedState());
  }
});

test("wait closes only the current night and preserves the once-per-game choice for a later night", () => {
  const state = freshAwakenedState();
  expect(closeAwakenedMimic(state, 1)).toBe(true);
  expect(closeAwakenedMimic(state, 1)).toBe(false);
  expect(canAwakenedMimic(state, 1)).toBe(false);
  expect(learnAwakenedRole(state, 5, "witch", 1)).toBe(false);
  expect(learnAwakenedRole(state, 5, "witch", 3)).toBe(true);
  expect(canAwakenedMimic(state, 4)).toBe(false);
  expect(learnAwakenedRole(state, 6, "guard", 4)).toBe(false);
  expect(state.learned).toMatchObject({
    role: "witch",
    day: 3,
    activationNight: null,
    skill: { kind: "poison", remaining: 1 },
  });
});

for (const kind of ["witch", "guard", "wolf"] as const)
  test(`${kind}: interrupted learning remains inactive until actual later night-end activation`, () => {
    const state = freshAwakenedState();
    learnAwakenedRole(state, 5, kind, 1);
    expect(awakenedSkillForNight(state, 2)).toBeUndefined();
    expect(activateAwakenedLearning(state, 3)).toBe(true);
    expect(state.learned).toMatchObject({ day: 1, activationNight: 3, activeFromNight: 4 });
    expect(awakenedSkillForNight(state, 3)).toBeUndefined();
    expect(awakenedSkillForNight(state, 4)?.kind).toBe(initialSkills[kind].kind);
    expect(activateAwakenedLearning(state, 4)).toBe(false);
    expect(state.learned!.activationNight).toBe(3);
  });

test("Hunter is armed at actual first-night end, independently of active next-night timing", () => {
  const state = freshAwakenedState();
  learnAwakenedRole(state, 5, "hunter", 1);
  expect(state.learned!.skill).toEqual({ kind: "hunter", canShoot: true, armed: false });
  expect(awakenedSkillForNight(state, 2)).toBeUndefined();
  expect(activateAwakenedLearning(state, 1)).toBe(true);
  expect(state.learned).toMatchObject({
    activationNight: 1,
    activeFromNight: 2,
    skill: { kind: "hunter", canShoot: true, armed: true },
  });
  expect(closeAwakenedSkill(state, 1)).toBe(false);
  expect(closeAwakenedSkill(state, 2)).toBe(false);
  expect(state.skillClosedDay).toBeNull();
  if (state.learned?.skill.kind !== "hunter") throw new Error("wrong fixture");
  state.learned.skill.canShoot = false;
  expect(activateAwakenedLearning(state, 2)).toBe(false);
  expect(state.learned.skill.canShoot).toBe(false);
});

test("Mirror readiness binds one installed ability ID and has no parallel history, uses or closed window", () => {
  const state = freshAwakenedState();
  learnAwakenedRole(state, 5, "mirror_girl", 1);
  expect(activateAwakenedLearning(state, 1)).toBe(false);
  expect(activateAwakenedLearning(state, 1, "")).toBe(false);
  expect(state.learned!.activationNight).toBeNull();
  expect(activateAwakenedLearning(state, 2, "native:role_check")).toBe(true);
  expect(state.learned).toEqual({
    targetId: 5,
    role: "mirror_girl",
    day: 1,
    activationNight: 2,
    activeFromNight: 3,
    skill: { kind: "inspection", abilityId: "native:role_check" },
  });
  expect(awakenedSkillForNight(state, 3)).toBeUndefined();
  expect(closeAwakenedSkill(state, 3)).toBe(false);
  expect(skipAwakenedSkill(state, 3)).toBe(false);
  expect(state.skillClosedDay).toBeNull();
  expect(activateAwakenedLearning(state, 3, "new-instance")).toBe(false);
  expect(state.learned!.skill).toEqual({ kind: "inspection", abilityId: "native:role_check" });
});

test("Villager never acquires a native active window and non-Mirror skills reject an ability ID", () => {
  const state = freshAwakenedState();
  learnAwakenedRole(state, 5, "villager", 1);
  expect(activateAwakenedLearning(state, 1, "extra")).toBe(false);
  expect(activateAwakenedLearning(state, 1)).toBe(true);
  expect(awakenedSkillForNight(state, 2)).toBeUndefined();
  expect(skipAwakenedSkill(state, 2)).toBe(false);
});

test("inheritance is once, starts no earlier than Night2 and remains independent of learning or passing", () => {
  const state = freshAwakenedState();
  expect(awakenedKnifeReady(state, 3)).toBe(false);
  expect(recordAwakenedInheritance(state, 1)).toBe(true);
  expect(state.firstKnifeNight).toBe(2);
  expect(awakenedKnifeReady(state, 1)).toBe(false);
  expect(awakenedKnifeReady(state, 2)).toBe(true);
  expect(closeAwakenedMimic(state, 2)).toBe(true);
  expect(awakenedKnifeReady(state, 2)).toBe(true);
  expect(recordAwakenedInheritance(state, 5)).toBe(false);
  expect(state.firstKnifeNight).toBe(2);
  const late = freshAwakenedState();
  recordAwakenedInheritance(late, 4);
  expect(late.firstKnifeNight).toBe(5);
  expect(awakenedKnifeReady(late, 4)).toBe(false);
  expect(awakenedKnifeReady(late, 5)).toBe(true);
});

test("Wolf extra knife can be learned after the first base-knife night, saved, and spent exactly once", () => {
  const state = freshAwakenedState();
  recordAwakenedInheritance(state, 1);
  learnAwakenedRole(state, 5, "wolf", 4);
  activateAwakenedLearning(state, 4);
  expect(canAwakenedExtraKnife(state, 4)).toBe(false);
  expect(canAwakenedExtraKnife(state, 5)).toBe(true);
  expect(chooseAwakenedAttack(state, null, 5)).toBe(true);
  expect(canAwakenedExtraKnife(state, 5)).toBe(false);
  expect(state.learned!.skill).toEqual({ kind: "wolf", extraKnife: "available" });
  expect(canAwakenedExtraKnife(state, 7)).toBe(true);
  expect(chooseAwakenedAttack(state, 6, 7)).toBe(true);
  expect(state.learned!.skill).toEqual({ kind: "wolf", extraKnife: "spent" });
  expect(canAwakenedExtraKnife(state, 8)).toBe(false);
  expect(awakenedSkillForNight(state, 8)).toBeUndefined();
  expect(skipAwakenedSkill(state, 8)).toBe(false);
  expect(chooseAwakenedAttack(state, 5, 8)).toBe(false);
  expect(awakenedKnifeReady(state, 8)).toBe(true);
  expect(recordAwakenedInheritance(state, 8)).toBe(false);
  expect(state.firstKnifeNight).toBe(2);
});

test("ready extra attack cannot consume stock without a persistent inheritance fact", () => {
  const state = freshAwakenedState();
  learnAwakenedRole(state, 5, "wolf", 1);
  activateAwakenedLearning(state, 1);
  expect(canAwakenedExtraKnife(state, 2)).toBe(false);
  expect(chooseAwakenedAttack(state, 6, 2)).toBe(false);
  expect(skipAwakenedSkill(state, 2)).toBe(false);
  expect(state.skillClosedDay).toBeNull();
  expect(state.learned!.skill).toEqual({ kind: "wolf", extraKnife: "available" });
});

test("adjacent stable Guard ID is rejected without payment, while null and tool-free wait break the chain", () => {
  for (const pass of ["null", "wait"] as const) {
    const state = freshAwakenedState();
    learnAwakenedRole(state, 5, "guard", 1);
    activateAwakenedLearning(state, 1);
    expect(chooseAwakenedGuard(state, 5, 2)).toBe(true);
    const before = structuredClone(state);
    expect(chooseAwakenedGuard(state, 5, 3)).toBe(false);
    expect(state).toEqual(before);
    expect(
      pass === "null" ? chooseAwakenedGuard(state, null, 3) : skipAwakenedSkill(state, 3),
    ).toBe(true);
    expect(chooseAwakenedGuard(state, 5, 4)).toBe(true);
    expect(state.learned!.skill).toEqual({ kind: "guard", lastTarget: 5, lastGuardDay: 4 });
    expect(chooseAwakenedGuard(state, 6, 4)).toBe(false);
    expect(chooseAwakenedGuard(state, 5, 6)).toBe(true);
  }
});

test("poison wait does not spend the bottle; real use closes the night and never refills", () => {
  const state = freshAwakenedState();
  learnAwakenedRole(state, 5, "witch", 1);
  activateAwakenedLearning(state, 1);
  expect(useAwakenedPoison(state, 1)).toBe(false);
  expect(skipAwakenedSkill(state, 2)).toBe(true);
  expect(state.learned!.skill).toEqual({ kind: "poison", remaining: 1 });
  expect(useAwakenedPoison(state, 2)).toBe(false);
  expect(useAwakenedPoison(state, 3)).toBe(true);
  expect(useAwakenedPoison(state, 4)).toBe(false);
  expect(awakenedSkillForNight(state, 4)).toBeUndefined();
  expect(skipAwakenedSkill(state, 4)).toBe(false);
  expect(state.learned!.skill).toEqual({ kind: "poison", remaining: 0 });
  expect(activateAwakenedLearning(state, 5)).toBe(false);
});

test("owned state is independent and JSON only; storage and projection never share a learning resource object", () => {
  const template = freshAwakenedState();
  learnAwakenedRole(template, 5, "witch", 1);
  activateAwakenedLearning(template, 1);
  // Generic state carriers do not register an unimplemented role or open an Aw board.
  const first = createRoleComponent(Role.Wolf, Camp.Wolf),
    second = createRoleComponent(Role.Wolf, Camp.Wolf);
  const a = setAwakenedState(first, template),
    b = setAwakenedState(second, template);
  expect(getAwakenedState(first)).toBe(a);
  expect(a).not.toBe(template);
  expect(a.learned).not.toBe(b.learned);
  expect(useAwakenedPoison(a, 2)).toBe(true);
  expect(b.learned!.skill).toEqual({ kind: "poison", remaining: 1 });
  expect(template.learned!.skill).toEqual({ kind: "poison", remaining: 1 });
  const projected = projectAwakenedState(a);
  expect(projected).not.toBe(a);
  expect(projected.learned).not.toBe(a.learned);
  expect(projected.learned!.skill).not.toBe(a.learned!.skill);
  expect(JSON.parse(JSON.stringify(projected))).toEqual(projected);
  expect(() =>
    setAwakenedState(first, { ...template, secret: new Map() } as typeof template),
  ).toThrow("ability_state_not_json");
});

for (const role of Object.keys(initialSkills) as AwakenedTemplateRole[])
  test(`${role}: projection drops unknown owner, learning and skill fields`, () => {
    const state = freshAwakenedState();
    learnAwakenedRole(state, 5, role, 1);
    const expected = structuredClone(state);
    Object.assign(state, { secret: "PRIVATE_STATE" });
    Object.assign(state.learned!, { originalInventory: "PRIVATE_LEARNING" });
    Object.assign(state.learned!.skill, {
      history: ["PRIVATE_HISTORY"],
      source: { secret: "PRIVATE_SOURCE" },
    });
    expect(projectAwakenedState(state)).toEqual(expected);
    expect(JSON.stringify(projectAwakenedState(state))).not.toContain("PRIVATE_");
  });

test("invalid day and target values cannot create or move paid facts", () => {
  for (const day of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    const state = freshAwakenedState();
    expect(canAwakenedMimic(state, day)).toBe(false);
    expect(closeAwakenedMimic(state, day)).toBe(false);
    expect(recordAwakenedInheritance(state, day)).toBe(false);
    expect(awakenedKnifeReady(state, day)).toBe(false);
    expect(state).toEqual(freshAwakenedState());
  }
  for (const id of [0, -1, 1.5, NaN, Infinity]) {
    const state = freshAwakenedState();
    expect(() => learnAwakenedRole(state, id, "wolf", 1)).toThrow(
      "awakened_learning_input_invalid",
    );
    expect(state).toEqual(freshAwakenedState());
  }
  const state = freshAwakenedState();
  learnAwakenedRole(state, 5, "guard", 3);
  expect(activateAwakenedLearning(state, 2)).toBe(false);
  expect(state.learned!.activationNight).toBeNull();
});
