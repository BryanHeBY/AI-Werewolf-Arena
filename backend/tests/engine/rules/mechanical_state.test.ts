import { expect, test } from "bun:test";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { Camp, Role } from "../../../src/core/domain/model";
import {
  advanceMechanicalNight, canMechanicalExtraKnife, canMechanicalMimic,
  closeMechanicalMimic, closeMechanicalSkill, chooseMechanicalGuard,
  freshMechanicalState, getMechanicalState, learnMechanicalRole,
  mechanicalKnifeSelected, mechanicalLearning, mechanicalSkillForNight,
  recordMechanicalInheritance, selectMechanicalMode, setMechanicalState,
} from "../../../src/game/mechanisms/roles/mechanical_wolf/state";

test("native mechanical owners deep-copy resources/history and contain serializable facts only", () => {
  const template = freshMechanicalState();
  learnMechanicalRole(template, 5, "psychic", 1);
  const first = createRoleComponent(Role.Wolf, Camp.Wolf), second = createRoleComponent(Role.Wolf, Camp.Wolf);
  const a = setMechanicalState(first, template), b = setMechanicalState(second, template);
  expect(getMechanicalState(first)).toBe(a);
  expect(a).not.toBe(template); expect(a.learned).not.toBe(b.learned);
  if (a.learned?.skill.kind !== "inspection" || b.learned?.skill.kind !== "inspection") throw new Error("wrong fixture");
  a.learned.skill.history.push({ day: 2, targetId: 4, result: { kind: "role", role: "witch" } });
  expect(b.learned.skill.history).toEqual([]);
  expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  expect(JSON.stringify(a)).not.toContain("casterId");
});

const initialSkills = {
  villager: { kind: "villager" }, psychic: { kind: "inspection", history: [] },
  witch: { kind: "poison", remaining: 1 }, guard: { kind: "guard", lastTarget: null, lastGuardDay: null },
  hunter: { kind: "hunter", canShoot: true, armed: false }, wolf: { kind: "wolf", extraKnife: "available" },
} as const;
for (const role of Object.keys(initialSkills) as Array<keyof typeof initialSkills>) {
  test(`${role}: learning has independent full initial resources and starts next night`, () => {
    expect(mechanicalLearning(7, role, 3)).toEqual({ targetId: 7, role, day: 3, readyOnNight: 4, skill: initialSkills[role] });
  });
}

test("unsupported learning does not spend a learning opportunity", () => {
  const state = freshMechanicalState();
  expect(() => learnMechanicalRole(state, 5, "seer", 1)).toThrow("mechanical_learning_role_not_supported");
  expect(state).toEqual(freshMechanicalState());
});

test("a skipped first-night learning remains available on later nights, and accepting it is once per game", () => {
  const state = freshMechanicalState();
  expect(closeMechanicalMimic(state, 1)).toBe(true);
  expect(canMechanicalMimic(state, 1)).toBe(false);
  expect(learnMechanicalRole(state, 5, "witch", 1)).toBe(false);
  expect(learnMechanicalRole(state, 5, "witch", 2)).toBe(true);
  expect(canMechanicalMimic(state, 3)).toBe(false);
  expect(learnMechanicalRole(state, 6, "guard", 3)).toBe(false);
  expect(state.learned).toEqual({ targetId: 5, role: "witch", day: 2, readyOnNight: 3, skill: { kind: "poison", remaining: 1 } });
});

test("night one has no mode, active skill or knife even with a pre-existing inheritance fact", () => {
  const state = freshMechanicalState();
  recordMechanicalInheritance(state, 1); learnMechanicalRole(state, 5, "witch", 1);
  expect(selectMechanicalMode(state, 1, "kill")).toBe(false);
  expect(mechanicalKnifeSelected(state, 1)).toBe(false);
  expect(mechanicalSkillForNight(state, 1)).toBeUndefined();
  expect(state.firstKnifeNight).toBe(2);
});

test("mode and learning are separate windows; late learning cannot act in the same night", () => {
  for (const mode of ["kill", "skill"] as const) {
    const state = freshMechanicalState();
    expect(selectMechanicalMode(state, 2, mode)).toBe(true);
    expect(learnMechanicalRole(state, 5, "psychic", 2)).toBe(true);
    expect(mechanicalSkillForNight(state, 2)).toBeUndefined();
    expect(selectMechanicalMode(state, 2, mode === "kill" ? "skill" : "kill")).toBe(false);
    expect(state.mode).toEqual({ day: 2, kind: mode });
    expect(selectMechanicalMode(state, 3, "skill")).toBe(true);
    expect(mechanicalSkillForNight(state, 3)?.kind).toBe("inspection");
  }
});

test("native active skill and inherited knife are mutually exclusive while gun readiness is independent", () => {
  const state = freshMechanicalState();
  recordMechanicalInheritance(state, 1); learnMechanicalRole(state, 5, "hunter", 1);
  advanceMechanicalNight(state, 1);
  expect(state.learned?.skill).toEqual({ kind: "hunter", canShoot: true, armed: false });
  advanceMechanicalNight(state, 2); selectMechanicalMode(state, 2, "kill");
  expect(state.learned?.skill).toEqual({ kind: "hunter", canShoot: true, armed: true });
  expect(mechanicalKnifeSelected(state, 2)).toBe(true);
  expect(mechanicalSkillForNight(state, 2)).toBeUndefined();
  selectMechanicalMode(state, 3, "skill");
  expect(mechanicalKnifeSelected(state, 3)).toBe(false);
  expect(mechanicalSkillForNight(state, 3)?.kind).toBe("hunter");
});

test("a legal active-skill skip closes only that night's window and does not consume poison", () => {
  const state = freshMechanicalState();
  learnMechanicalRole(state, 5, "witch", 1); selectMechanicalMode(state, 2, "skill");
  expect(closeMechanicalSkill(state, 2)).toBe(true);
  expect(closeMechanicalSkill(state, 2)).toBe(false);
  expect(mechanicalSkillForNight(state, 2)).toBeUndefined();
  expect(state.learned?.skill).toEqual({ kind: "poison", remaining: 1 });
  selectMechanicalMode(state, 3, "skill");
  expect(mechanicalSkillForNight(state, 3)?.kind).toBe("poison");
});

test("first knife night is fixed by actual inheritance and never reset by another proposal", () => {
  const state = freshMechanicalState();
  expect(recordMechanicalInheritance(state, 4)).toBe(true);
  expect(state.firstKnifeNight).toBe(5);
  expect(recordMechanicalInheritance(state, 8)).toBe(false);
  expect(state.firstKnifeNight).toBe(5);
  selectMechanicalMode(state, 4, "kill");
  expect(mechanicalKnifeSelected(state, 4)).toBe(false);
  selectMechanicalMode(state, 5, "kill");
  expect(mechanicalKnifeSelected(state, 5)).toBe(true);
});

test("extra knife exists only in the first inherited knife night and is not replenished", () => {
  const state = freshMechanicalState();
  learnMechanicalRole(state, 5, "wolf", 1); recordMechanicalInheritance(state, 2);
  selectMechanicalMode(state, 2, "kill"); expect(canMechanicalExtraKnife(state, 2)).toBe(false);
  selectMechanicalMode(state, 3, "kill"); expect(canMechanicalExtraKnife(state, 3)).toBe(true);
  if (state.learned?.skill.kind !== "wolf") throw new Error("wrong fixture");
  state.learned.skill.extraKnife = "spent";
  expect(canMechanicalExtraKnife(state, 3)).toBe(false);
  advanceMechanicalNight(state, 4); selectMechanicalMode(state, 4, "kill");
  expect(state.learned.skill.extraKnife).toBe("spent");
  expect(canMechanicalExtraKnife(state, 4)).toBe(false);
});

test("skill-mode, an entirely skipped window and late Wolf learning all expire the extra knife", () => {
  for (const choice of ["skill", "skip", "late"] as const) {
    const state = freshMechanicalState();
    if (choice !== "late") learnMechanicalRole(state, 5, "wolf", 1);
    recordMechanicalInheritance(state, 1);
    if (choice === "skill") selectMechanicalMode(state, 2, "skill");
    if (choice === "late") learnMechanicalRole(state, 5, "wolf", 2);
    advanceMechanicalNight(state, 3); selectMechanicalMode(state, 3, "kill");
    expect(state.learned?.skill).toEqual({ kind: "wolf", extraKnife: "expired" });
    expect(canMechanicalExtraKnife(state, 3)).toBe(false);
    expect(mechanicalKnifeSelected(state, 3)).toBe(true);
  }
});

test("only consecutive actual night IDs fail guard; skipping, kill mode and empty guard break the chain", () => {
  const guard = () => ({ kind: "guard" as const, lastTarget: null, lastGuardDay: null });
  const consecutive = guard();
  expect(chooseMechanicalGuard(consecutive, 5, 2)).toEqual({ failed: false });
  expect(chooseMechanicalGuard(consecutive, 5, 3)).toEqual({ failed: true });
  const gap = guard(); chooseMechanicalGuard(gap, 5, 2);
  expect(chooseMechanicalGuard(gap, 5, 4)).toEqual({ failed: false });
  const empty = guard(); chooseMechanicalGuard(empty, 5, 2); chooseMechanicalGuard(empty, null, 3);
  expect(chooseMechanicalGuard(empty, 5, 4)).toEqual({ failed: false });
});
