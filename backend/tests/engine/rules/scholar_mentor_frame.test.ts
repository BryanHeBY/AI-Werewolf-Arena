import { expect, test } from "bun:test";
import { COMPONENT, Camp, type RoleComponent, type World } from "../../../src/core";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import {
  createModifierState,
  type ModifierState,
} from "../../../src/game/mechanisms/roles/scholar_mentor/state";
import {
  installScholarMentorBoard,
  beginScholarMentorNight,
  commitScholarMentorChoice,
  settleScholarMentorChoices,
  scholarMentorChoicePending,
  scholarMentorChoiceTargets,
  scholarMentorBlocks,
  scholarMentorKnifeEligible,
  recordScholarMentorNativeTarget,
  scholarMentorBonusActors,
  scholarMentorBonusTargets,
  captureScholarMentorBonus,
  scholarMentorConflictDeaths,
  closeScholarMentorNight,
  abortScholarMentorNight,
  assertScholarMentorRosterCurrent,
  scholarMentorRoleCanKnife,
  scholarMentorPackBlocked,
  scholarMentorStateForRole,
} from "../../../src/game/mechanisms/roles/scholar_mentor/night_frame";
function fixture() {
  const names = [
    "day_scholar",
    "night_mentor",
    "seer",
    "guard",
    "witch",
    "wolf",
    "wolf",
    "wolf",
    "villager",
    "villager",
    "villager",
    "villager",
  ];
  const states = new Map<number, ModifierState>([
    [1, createModifierState("day_scholar")],
    [2, createModifierState("night_mentor")],
  ]);
  const roles = new Map(
    names.map((role, i) => [
      i + 1,
      {
        role,
        camp: role === "wolf" || role === "night_mentor" ? Camp.Wolf : Camp.Good,
        privateState: states.has(i + 1) ? { scholarMentor: states.get(i + 1) } : {},
      } as unknown as RoleComponent,
    ]),
  );
  for (const [id, kind] of [
    [3, "seer_check"],
    [4, "guard"],
    [5, "potion"],
  ] as const) {
    const role = roles.get(id)!;
    role.privateState.abilities = {
      native: {
        id: "native",
        kind,
        state: {},
        source: { kind: "native", role: role.role },
        sourceDisclosed: true,
        startsOnDay: 1,
        maxUses: null,
        uses: 0,
        lastUsedDay: null,
        disabled: false,
      },
    };
  }
  const lives = new Map([...roles.keys()].map((id) => [id, createAliveComponent()]));
  const identities = new Map(
    [...roles.keys()].map((id) => [
      id,
      { id, seat: id, name: "Player " + id, sessionId: "p" + id },
    ]),
  );
  const world = {
    entityIds: () => [...roles.keys()],
    getComponent: (id: number, kind: unknown) =>
      kind === COMPONENT.Role
        ? roles.get(id)
        : kind === COMPONENT.Alive
          ? lives.get(id)
          : kind === COMPONENT.Identity
            ? identities.get(id)
            : undefined,
  } as unknown as World;
  installScholarMentorBoard(world);
  return { world, states, roles, lives, identities };
}
function second(f: ReturnType<typeof fixture>) {
  expect(beginScholarMentorNight(f.world, 1)).toEqual([]);
  settleScholarMentorChoices(f.world, 1);
  closeScholarMentorNight(f.world, 1);
  return beginScholarMentorNight(f.world, 2);
}
function guardGrant(f: ReturnType<typeof fixture>) {
  second(f);
  commitScholarMentorChoice(f.world, 2, 1, "enhance", 4);
  commitScholarMentorChoice(f.world, 2, 2, null, null);
  settleScholarMentorChoices(f.world, 2);
  recordScholarMentorNativeTarget(f.world, 2, 4, "guard", 9);
}
test("Modifier frame requires both choices and keeps charge identity", () => {
  const f = fixture();
  expect(second(f)).toEqual([1, 2]);
  expect(scholarMentorChoicePending(f.world, 2, 1)).toBe(true);
  expect(scholarMentorChoiceTargets(f.world, 2, 1)).toContain(1);
  expect(() => settleScholarMentorChoices(f.world, 2)).toThrow("choices_unsettled");
  commitScholarMentorChoice(f.world, 2, 1, "weaken", 3);
  expect(() => commitScholarMentorChoice(f.world, 2, 1, "enhance", 4)).toThrow("choice_scope");
  commitScholarMentorChoice(f.world, 2, 2, null, null);
  const result = settleScholarMentorChoices(f.world, 2);
  expect(result.goodEffects).toEqual([{ targetId: 3, role: "seer", mode: "weaken" }]);
  expect(scholarMentorBlocks(f.world, 2, 3, "check")).toBe(true);
  expect(scholarMentorBlocks(f.world, 2, 4, "guard")).toBe(false);
  expect(f.states.get(1)!.remaining).toEqual({ enhance: 1, weaken: 0 });
  closeScholarMentorNight(f.world, 2);
  beginScholarMentorNight(f.world, 3);
  expect(() => commitScholarMentorChoice(f.world, 3, 1, "weaken", 4)).toThrow("charge_spent");
});
test("Modifier pending conflict death preserves native action eligibility", () => {
  const f = fixture();
  second(f);
  commitScholarMentorChoice(f.world, 2, 1, "enhance", 3);
  commitScholarMentorChoice(f.world, 2, 2, "weaken", 3);
  const result = settleScholarMentorChoices(f.world, 2);
  expect(result.pendingDeaths).toEqual([3]);
  expect(f.lives.get(3)!.alive).toBe(true);
  expect(scholarMentorBlocks(f.world, 2, 3, "check")).toBe(false);
  expect(scholarMentorConflictDeaths(f.world, 2).map((s) => s.id)).toEqual([3]);
  recordScholarMentorNativeTarget(f.world, 2, 3, "check", 6);
  f.lives.get(3)!.alive = false;
  closeScholarMentorNight(f.world, 2);
  expect(() => assertScholarMentorRosterCurrent(f.world)).not.toThrow();
});
test("Modifier both wolf conflict cancels pack modifiers and defers Mentor death", () => {
  const f = fixture();
  second(f);
  commitScholarMentorChoice(f.world, 2, 1, "enhance", 6);
  commitScholarMentorChoice(f.world, 2, 2, "weaken", 7);
  expect(settleScholarMentorChoices(f.world, 2).pendingDeaths).toEqual([2]);
  expect(scholarMentorBlocks(f.world, 2, 6, "kill")).toBe(false);
  expect(scholarMentorBonusActors(f.world, 2, "kill")).toEqual([]);
  expect(f.lives.get(2)!.alive).toBe(true);
  closeScholarMentorNight(f.world, 2);
});
test("Modifier bonus is separate, distinct, one use and requires completed native opportunity", () => {
  const f = fixture();
  second(f);
  commitScholarMentorChoice(f.world, 2, 1, "enhance", 4);
  commitScholarMentorChoice(f.world, 2, 2, null, null);
  settleScholarMentorChoices(f.world, 2);
  expect(scholarMentorBonusTargets(f.world, 2, 4, "guard")).toEqual([]);
  expect(() => captureScholarMentorBonus(f.world, 2, 4, "guard", 10)).toThrow("bonus_unavailable");
  recordScholarMentorNativeTarget(f.world, 2, 4, "guard", 9);
  expect(() => recordScholarMentorNativeTarget(f.world, 2, 4, "guard", 10)).toThrow(
    "native_target_invalid",
  );
  expect(scholarMentorBonusTargets(f.world, 2, 4, "guard")).not.toContain(9);
  expect(() => captureScholarMentorBonus(f.world, 2, 4, "guard", 9)).toThrow("bonus_unavailable");
  expect(() => closeScholarMentorNight(f.world, 2)).toThrow("bonus_unresolved");
  const token = captureScholarMentorBonus(f.world, 2, 4, "guard", 10);
  expect(token.isCurrent()).toBe(true);
  expect(token.effectCurrent()).toBe(false);
  token.commit();
  expect(token.isCurrent()).toBe(false);
  expect(token.effectCurrent()).toBe(true);
  expect(() => token.commit()).toThrow("bonus_stale");
  expect(scholarMentorBonusActors(f.world, 2, "guard")).toEqual([]);
  closeScholarMentorNight(f.world, 2);
  expect(token.effectCurrent()).toBe(false);
  beginScholarMentorNight(f.world, 3);
  commitScholarMentorChoice(f.world, 3, 1, null, null);
  commitScholarMentorChoice(f.world, 3, 2, null, null);
  settleScholarMentorChoices(f.world, 3);
  expect(scholarMentorBonusActors(f.world, 3, "guard")).toEqual([]);
});
test("Modifier two independent grants do not revoke each other's committed effect", () => {
  const f = fixture();
  second(f);
  commitScholarMentorChoice(f.world, 2, 1, "enhance", 4);
  commitScholarMentorChoice(f.world, 2, 2, "enhance", 3);
  settleScholarMentorChoices(f.world, 2);
  recordScholarMentorNativeTarget(f.world, 2, 4, "guard", 9);
  recordScholarMentorNativeTarget(f.world, 2, 3, "check", 6);
  const guard = captureScholarMentorBonus(f.world, 2, 4, "guard", 10),
    seer = captureScholarMentorBonus(f.world, 2, 3, "check", 7);
  guard.commit();
  expect(seer.isCurrent()).toBe(true);
  seer.commit();
  expect(guard.effectCurrent()).toBe(true);
  closeScholarMentorNight(f.world, 2);
});
test("Modifier optional bonus pass consumes only ephemeral grant", () => {
  const f = fixture();
  guardGrant(f);
  const token = captureScholarMentorBonus(f.world, 2, 4, "guard", null);
  token.commit();
  expect(token.target).toBeNull();
  expect(scholarMentorBonusActors(f.world, 2, "guard")).toEqual([]);
  const abilities = f.roles.get(4)!.privateState.abilities as Record<
    string,
    { uses: number; lastUsedDay: number | null }
  >;
  expect(abilities.native!.uses).toBe(0);
  expect(abilities.native!.lastUsedDay).toBeNull();
  closeScholarMentorNight(f.world, 2);
});
test("Modifier weakening Witch only blocks poison and pack weakness blocks all knives", () => {
  const f = fixture();
  second(f);
  commitScholarMentorChoice(f.world, 2, 1, "weaken", 5);
  commitScholarMentorChoice(f.world, 2, 2, "weaken", 6);
  settleScholarMentorChoices(f.world, 2);
  expect(scholarMentorBlocks(f.world, 2, 5, "poison")).toBe(true);
  expect(scholarMentorBlocks(f.world, 2, 5, "check")).toBe(false);
  for (const id of [2, 6, 7, 8]) expect(scholarMentorBlocks(f.world, 2, id, "kill")).toBe(true);
  closeScholarMentorNight(f.world, 2);
});
test("Modifier Mentor knife inheritance uses night-start pack snapshot", () => {
  const f = fixture();
  second(f);
  expect(scholarMentorKnifeEligible(f.world, 2, 2)).toBe(false);
  for (const id of [6, 7, 8]) f.lives.get(id)!.alive = false;
  expect(scholarMentorKnifeEligible(f.world, 2, 2)).toBe(false);
  commitScholarMentorChoice(f.world, 2, 1, null, null);
  commitScholarMentorChoice(f.world, 2, 2, null, null);
  settleScholarMentorChoices(f.world, 2);
  closeScholarMentorNight(f.world, 2);
  beginScholarMentorNight(f.world, 3);
  expect(scholarMentorKnifeEligible(f.world, 3, 2)).toBe(true);
});
for (const mutation of [
  "state",
  "remaining-ref",
  "history-ref",
  "role",
  "identity",
  "target-life",
  "source-death",
  "revive",
  "disabled",
  "expiry-accessor",
  "abort",
] as const)
  test("Modifier grant rejects stale authority/" + mutation, () => {
    const f = fixture();
    guardGrant(f);
    const token = captureScholarMentorBonus(f.world, 2, 4, "guard", 10);
    if (mutation === "state") f.states.get(1)!.remaining.enhance = 1;
    else if (mutation === "remaining-ref")
      f.states.get(1)!.remaining = { ...f.states.get(1)!.remaining };
    else if (mutation === "history-ref") f.states.get(1)!.history = [...f.states.get(1)!.history];
    else if (mutation === "role") f.roles.set(4, { ...f.roles.get(4)! });
    else if (mutation === "identity") f.identities.get(10)!.seat = 99;
    else if (mutation === "target-life") f.lives.set(10, createAliveComponent());
    else if (mutation === "source-death") f.lives.get(4)!.alive = false;
    else if (mutation === "revive") {
      f.lives.get(1)!.alive = false;
      f.lives.get(1)!.alive = true;
    } else if (mutation === "abort") abortScholarMentorNight(f.world);
    else {
      const ability = (
        f.roles.get(4)!.privateState.abilities as Record<string, Record<string, unknown>>
      ).native!;
      if (mutation === "disabled") ability.disabled = true;
      else Object.defineProperty(ability, "expiresAfterDay", { get: () => 0 });
    }
    expect(token.isCurrent()).toBe(false);
    expect(() => token.commit()).toThrow("bonus_stale");
  });
test("Modifier committed caster death preserves grant but revival revokes board", () => {
  const f = fixture();
  guardGrant(f);
  const token = captureScholarMentorBonus(f.world, 2, 4, "guard", 10);
  f.lives.get(1)!.alive = false;
  expect(token.isCurrent()).toBe(true);
  token.commit();
  expect(token.effectCurrent()).toBe(true);
  f.lives.get(1)!.alive = true;
  expect(token.effectCurrent()).toBe(false);
});

test("Modifier completed close tolerates finally cleanup; interrupted night cannot restart", () => {
  const f = fixture();
  beginScholarMentorNight(f.world, 1);
  settleScholarMentorChoices(f.world, 1);
  closeScholarMentorNight(f.world, 1);
  abortScholarMentorNight(f.world);
  expect(() => beginScholarMentorNight(f.world, 2)).not.toThrow();
  abortScholarMentorNight(f.world);
  expect(() => beginScholarMentorNight(f.world, 3)).toThrow("night_invalid");
});
test("Modifier role permissions remain private and use the captured night roster", () => {
  const f = fixture();
  expect(scholarMentorRoleCanKnife(f.world, f.roles.get(2)!)).toBe(false);
  expect(scholarMentorStateForRole(f.roles.get(1))).toBe(f.states.get(1));
  expect(scholarMentorStateForRole(f.roles.get(6))).toBeUndefined();
  second(f);
  commitScholarMentorChoice(f.world, 2, 1, "weaken", 6);
  commitScholarMentorChoice(f.world, 2, 2, null, null);
  settleScholarMentorChoices(f.world, 2);
  expect(scholarMentorPackBlocked(f.world)).toBe(true);
  for (const id of [6, 7, 8]) f.lives.get(id)!.alive = false;
  expect(scholarMentorRoleCanKnife(f.world, f.roles.get(2)!)).toBe(false);
  closeScholarMentorNight(f.world, 2);
  abortScholarMentorNight(f.world);
  beginScholarMentorNight(f.world, 3);
  expect(scholarMentorRoleCanKnife(f.world, f.roles.get(2)!)).toBe(true);
  expect(scholarMentorPackBlocked(f.world)).toBe(false);
});

for (const owner of [2, 9])
  for (const mutation of ["getter", "inherited-getter", "undefined-field"] as const)
    test("Modifier rejects absent ability container injection/" + owner + "/" + mutation, () => {
      const f = fixture();
      guardGrant(f);
      const token = captureScholarMentorBonus(f.world, 2, 4, "guard", 10);
      const state = f.roles.get(owner)!.privateState,
        donor = f.roles.get(4)!.privateState.abilities;
      let reads = 0;
      if (mutation === "getter")
        Object.defineProperty(state, "abilities", {
          get: () => {
            reads++;
            return donor;
          },
        });
      else if (mutation === "inherited-getter")
        Object.setPrototypeOf(state, {
          get abilities() {
            reads++;
            return donor;
          },
        });
      else Object.defineProperty(state, "abilities", { value: undefined });
      expect(token.isCurrent()).toBe(false);
      expect(reads).toBe(0);
      expect(() => token.commit()).toThrow("bonus_stale");
    });
