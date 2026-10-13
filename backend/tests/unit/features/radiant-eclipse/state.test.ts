/**
 * Unit tests for radiant-eclipse; Isolated radiant-eclipse state contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import {
  createShelterState,
  createEclipseState,
  readShelterState,
  readEclipseState,
  selectShelter,
  selectEclipse,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/state";
import { snapshotBorrowedState } from "../../../../src/game/mechanisms/roles/radiant_eclipse/borrowed_state";
import { DREAMER_ROLE_PROFILE } from "../../../../src/game/mechanisms/roles/dreamer/profile";
import { WITCH_ROLE_PROFILE } from "../../../../src/game/mechanisms/roles/witch/profile";
import {
  getDreamerState,
  getWitchState,
} from "../../../../src/game/mechanisms/roles/private_state";
import { createRoleComponent } from "../../../../src/core/domain/components/role";
import { Camp, Role, WitchSelfHealRule } from "../../../../src/core/domain/identity";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";

test("shelter starts at N2, cannot self or repeat across consecutive actual nights; a pass breaks repeat", () => {
  let state = createShelterState();
  expect(() => selectShelter(state, 1, 4, 1, [1, 4])).toThrow();
  expect(() => selectShelter(state, 2, 1, 1, [1, 4])).toThrow();
  state = selectShelter(state, 2, 4, 1, [1, 4]);
  expect(() => selectShelter(state, 3, 4, 1, [1, 4])).toThrow();
  expect(selectShelter(state, 4, 4, 1, [1, 4])).toMatchObject({
    lastTarget: 4,
    lastDay: 4,
  });
  state = selectShelter(state, 3, null, 1, [1, 4]);
  expect(selectShelter(state, 4, 4, 1, [1, 4])).toMatchObject({
    lastTarget: 4,
    lastDay: 4,
  });
  expect(() => selectShelter(state, 3, null, 1, [1, 4])).toThrow();
});

test("swallow records villager without a fake ability and distinguishes explicit pass", () => {
  let state = selectEclipse(createEclipseState(), 2, 4, [4, 5], "villager");
  expect(state.history).toEqual([{ day: 2, targetId: 4, roleId: "villager", abilityId: null }]);
  expect(() => selectEclipse(state, 3, 4, [4, 5], "villager")).toThrow();
  state = selectEclipse(state, 3, null, [4, 5], null);
  state = selectEclipse(state, 4, 4, [4, 5], "villager");
  expect(readEclipseState(state)).toEqual(state);
  expect(selectEclipse(createEclipseState(), 2, 5, [4, 5], "witch").history).toEqual([
    { day: 2, targetId: 5, roleId: "witch", abilityId: "copy:eclipse:night:2" },
  ]);
  expect(() => selectEclipse(createEclipseState(), 2, 3, [4, 5], "wolf")).toThrow();
});

test("current-state snapshots ignore private history and preserve exact stock/prior dream target", () => {
  const poisonousHistory = {
    get history() {
      throw new Error("must_not_read_history");
    },
    get lastResult() {
      throw new Error("must_not_read_result");
    },
    uses: 731,
    lastUsedDay: 619,
  };
  const seer = snapshotBorrowedState("seer_check", poisonousHistory, 2);
  expect(seer).toEqual({
    targetPolicy: "awa_alive_v1",
    actionPolicy: "awa_required_when_legal_v1",
    lastTarget: null,
    lastIsWerewolf: null,
    lastResult: null,
    history: [],
  });
  const potion = snapshotBorrowedState(
    "potion",
    {
      selfHealRule: "disabled",
      heal: 1,
      poison: 0,
      get history() {
        throw new Error("must_not_read_history");
      },
    },
    2,
  );
  expect([
    potion.heal,
    potion.poison,
    potion.healUsedThisNight,
    potion.poisonUsedThisNight,
  ]).toEqual([1, 0, false, false]);
});

test("snapshot clones only previous dream/shelter repeat fields, never history or source inventory ownership", () => {
  const source = {
    lastTarget: 4,
    lastDay: 1,
    protectionPolicy: "netease_2026_night_immunity_v1",
    get history() {
      throw new Error("must_not_read_history");
    },
  };
  expect(snapshotBorrowedState("dream", source, 2)).toEqual({
    lastTarget: 4,
    lastDay: 1,
    protectionPolicy: "netease_2026_night_immunity_v1",
    history: [],
  });
  const count = selectShelter(createShelterState(), 2, 4, 1, [1, 4]);
  const borrowed = snapshotBorrowedState("shelter", count, 3);
  expect(borrowed).toEqual(count);
  expect(borrowed).not.toBe(count);
  expect(() => selectShelter(borrowed, 3, 4, 5, [4, 5])).toThrow();
  const original = { selfHealRule: "disabled", heal: 1, poison: 0 };
  const potion = snapshotBorrowedState("potion", original, 2);
  potion.heal--;
  expect(original).toEqual({ selfHealRule: "disabled", heal: 1, poison: 0 });
  expect(snapshotBorrowedState("potion", original, 4).heal).toBe(1);
  original.heal--;
  expect(snapshotBorrowedState("potion", original, 4).heal).toBe(0);
  expect(() =>
    snapshotBorrowedState("potion", { selfHealRule: "disabled", heal: 2, poison: 0 }, 4),
  ).toThrow();
});

test("state readers reject accessors, proxies, malformed histories and future borrowed context", () => {
  let invoked = 0;
  const hostile = {
    policy: "awa_radiant_eclipse_v1",
    lastDay: 2,
    get lastTarget() {
      invoked++;
      return 4;
    },
  };
  expect(readShelterState(hostile)).toBeUndefined();
  expect(invoked).toBe(0);
  expect(
    readShelterState(
      new Proxy(createShelterState(), {
        getOwnPropertyDescriptor() {
          throw new Error("proxy_trap");
        },
      }),
    ),
  ).toBeUndefined();
  const duplicated = selectEclipse(createEclipseState(), 2, 4, [4], "seer");
  duplicated.history.push({ ...duplicated.history[0] });
  expect(readEclipseState(duplicated)).toBeUndefined();
  expect(() =>
    snapshotBorrowedState(
      "potion",
      {
        selfHealRule: "disabled",
        get heal() {
          invoked++;
          return 1;
        },
        poison: 0,
      },
      2,
    ),
  ).toThrow();
  expect(invoked).toBe(0);
  expect(() =>
    snapshotBorrowedState(
      "dream",
      { lastTarget: 4, lastDay: 2, protectionPolicy: "netease_2026_night_immunity_v1" },
      2,
    ),
  ).toThrow();
});

test("shelter repeat is inherited per ability, not globally from the borrower's intervening night", () => {
  const original = selectShelter(createShelterState(), 2, 4, 1, [1, 4, 5, 9]);
  const copied = snapshotBorrowedState("shelter", original, 3);
  const borrowed = selectShelter(copied, 3, 5, 9, [1, 4, 5, 9]);
  expect(borrowed).toMatchObject({ lastTarget: 5, lastDay: 3 });
  expect(original).toMatchObject({ lastTarget: 4, lastDay: 2 });
  expect(selectShelter(original, 4, 5, 1, [1, 4, 5, 9])).toMatchObject({
    lastTarget: 5,
    lastDay: 4,
  });
  expect(() => selectShelter(copied, 3, 4, 9, [1, 4, 5, 9])).toThrow();
});

test("a real default Dream ability cannot silently gain the finite board's stronger protection", () => {
  const role = createRoleComponent(Role.Dreamer, Camp.Good);
  DREAMER_ROLE_PROFILE.init!(role, {});
  const original = getDreamerState(role)!;
  expect(original.protectionPolicy).toBeUndefined();
  expect(() => snapshotBorrowedState("dream", original, 2)).toThrow(
    "eclipse_borrow_policy_invalid",
  );
  DREAMER_ROLE_PROFILE.init!(role, {
    boardConfig: {
      ...sixPlayerMvpConfig,
      dreamer: { protectionPolicy: "netease_2026_night_immunity_v1" },
    },
  });
  const supported = getDreamerState(role)!;
  (supported as { lastDay: number | null }).lastDay = 1;
  (supported as { lastTarget: number | null }).lastTarget = 4;
  (
    supported.history as {
      day: number;
      targetId: import("@ai-werewolf-arena/game-contract").EntityId;
    }[]
  ).push({ day: 1, targetId: 4 });
  const copied = snapshotBorrowedState("dream", supported, 2);
  expect(copied).toEqual({
    lastTarget: 4,
    lastDay: 1,
    protectionPolicy: "netease_2026_night_immunity_v1",
    history: [],
  });
  copied.lastTarget = 5;
  copied.history.push({ day: 2, targetId: 5 });
  expect(supported.history).toEqual([{ day: 1, targetId: 4 }]);
  expect(supported.lastTarget).toBe(4);
});

test("all four native potion stocks are copied exactly without historical or lifecycle metadata", () => {
  let reads = 0;
  for (const heal of [0, 1])
    for (const poison of [0, 1]) {
      const role = createRoleComponent(Role.Witch, Camp.Good);
      WITCH_ROLE_PROFILE.init!(role, {
        boardConfig: { ...sixPlayerMvpConfig, witch: { canSelfHeal: WitchSelfHealRule.Disabled } },
      });
      const original = getWitchState(role)!;
      (original as { heal: number }).heal = heal;
      (original as { poison: number }).poison = poison;
      for (const key of [
        "history",
        "uses",
        "lastUsedDay",
        "nightSuppression",
        "potionTurnClosedDay",
      ])
        Object.defineProperty(original, key, {
          get() {
            reads++;
            throw new Error("private_canary");
          },
        });
      const copied = snapshotBorrowedState("potion", original, 2);
      expect(copied).toEqual({
        heal,
        poison,
        selfHealRule: WitchSelfHealRule.Disabled,
        knifeVisibility: "awa_with_heal_v1",
        potionPolicy: "awa_one_native_v1",
        canSelfHeal: false,
        healUsedThisNight: false,
        poisonUsedThisNight: false,
      });
      copied.heal = 0;
      copied.poison = 0;
      expect([original.heal, original.poison]).toEqual([heal, poison]);
    }
  expect(reads).toBe(0);
  expect(() => snapshotBorrowedState("potion", { heal: 1, poison: 0 }, 2)).toThrow(
    "eclipse_borrow_policy_invalid",
  );
  expect(() =>
    snapshotBorrowedState("potion", { heal: 1, poison: 0, selfHealRule: "first_night_only" }, 2),
  ).toThrow("eclipse_borrow_policy_invalid");
});
