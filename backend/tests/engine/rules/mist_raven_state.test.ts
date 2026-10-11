import { expect, test } from "bun:test";
import {
  createAlchemistState,
  readAlchemistState,
  selectMist,
  selectSnake,
  createRavenState,
  readRavenState,
  unsealRaven,
  selectRavenKnife,
} from "../../../src/game/mechanisms/roles/mist_raven/state";

test("independent mist and snake stocks can be spent for the same night without mutating the input", () => {
  const initial = createAlchemistState(),
    mist = selectMist(initial, 1, [3, 1, 2], [1, 2, 3, 4]),
    healed = selectSnake(mist, 1, 1, [1]);
  expect(initial).toEqual(createAlchemistState());
  expect(healed.mistRemaining).toBe(0);
  expect(healed.healRemaining).toBe(0);
  expect(readAlchemistState(healed)).toEqual(healed);
  expect(() => selectMist(healed, 2, [1, 2, 3], [1, 2, 3])).toThrow("mist_choice_unavailable");
  expect(() => selectSnake(healed, 2, 2, [2])).toThrow("snake_choice_unavailable");
});
test("legal pass retains resources but consumes that night's decision", () => {
  let state = selectMist(createAlchemistState(), 1, null, [1, 2]);
  state = selectSnake(state, 1, null, []);
  expect(state.mistRemaining).toBe(1);
  expect(state.healRemaining).toBe(1);
  expect(() => selectMist(state, 1, null, [1, 2])).toThrow("mist_choice_unavailable");
  expect(() => selectSnake(state, 1, null, [])).toThrow("snake_choice_unavailable");
  state = selectMist(state, 2, [1, 2, 3], [1, 2, 3]);
  state = selectSnake(state, 2, 2, [2]);
  expect(readAlchemistState(state)).toEqual(state);
});
test("mist uses exactly three distinct current players and accepts the caster or wolves as ordinary ids", () => {
  for (const targets of [[], [1], [1, 2], [1, 1, 2], [1, 2, 3, 4], [1, 2, 8], [0, 1, 2]])
    expect(() => selectMist(createAlchemistState(), 1, targets, [1, 2, 3, 4])).toThrow(
      "mist_choice_target_invalid",
    );
  expect(selectMist(createAlchemistState(), 1, [4, 2, 1], [1, 2, 3, 4]).mistHistory).toEqual([
    { day: 1, targetIds: [4, 2, 1] },
  ]);
});
test("empty or already publicly dead knife only permits pass and never spends snake", () => {
  for (const target of [1, 2])
    expect(() => selectSnake(createAlchemistState(), 1, target, [])).toThrow(
      "snake_choice_target_invalid",
    );
  expect(selectSnake(createAlchemistState(), 1, null, []).healRemaining).toBe(1);
});
test("state rejects forged stock, post-spend histories and duplicate nights", () => {
  const done = selectSnake(selectMist(createAlchemistState(), 1, [1, 2, 3], [1, 2, 3]), 1, 1, [1]);
  expect(readAlchemistState({ ...done, mistRemaining: 1 })).toBeUndefined();
  expect(readAlchemistState({ ...done, healRemaining: 1 })).toBeUndefined();
  expect(
    readAlchemistState({
      ...done,
      mistHistory: [...done.mistHistory, { day: 2, targetIds: null }],
    }),
  ).toBeUndefined();
  expect(
    readAlchemistState({
      ...done,
      healHistory: [...done.healHistory, { day: 2, targetId: null }],
    }),
  ).toBeUndefined();
  expect(
    readAlchemistState({
      ...createAlchemistState(),
      healHistory: [
        { day: 1, targetId: null },
        { day: 1, targetId: null },
      ],
    }),
  ).toBeUndefined();
});
test("raven is sealed at three wolves and learns only the two-wolf start snapshot", () => {
  const original = createRavenState();
  expect(unsealRaven(original, 1, 3, [1, 2, 3])).toEqual(original);
  const awake = unsealRaven(original, 2, 3, [2, 3]);
  expect(awake.awakenedDay).toBe(2);
  expect(awake.knownTeammateIds).toEqual([2]);
  expect(unsealRaven(awake, 3, 3, [3]).knownTeammateIds).toEqual([2]);
  expect(readRavenState(awake)).toEqual(awake);
  expect(unsealRaven(original, 2, 3, [3]).knownTeammateIds).toEqual([]);
});
test("raven extra knife skips retain stock, chooses outside any mist and spends once", () => {
  const awake = unsealRaven(createRavenState(), 2, 3, [2, 3]);
  const skip = selectRavenKnife(awake, 2, 3, null, [2, 3, 4]);
  expect(skip.extraRemaining).toBe(1);
  expect(() => selectRavenKnife(skip, 2, 3, 4, [2, 3, 4])).toThrow("raven_knife_unavailable");
  const used = selectRavenKnife(skip, 3, 3, 4, [2, 3, 4]);
  expect(used.extraRemaining).toBe(0);
  expect(readRavenState(used)).toEqual(used);
  expect(() => selectRavenKnife(used, 4, 3, 2, [2, 3])).toThrow("raven_knife_unavailable");
});
test("sealed raven, past night, self and dead targets reject without granting inventory", () => {
  const sealed = createRavenState(),
    awake = unsealRaven(sealed, 2, 3, [2, 3]);
  expect(() => selectRavenKnife(sealed, 1, 3, null, [1, 2, 3])).toThrow("raven_knife_unavailable");
  expect(() => selectRavenKnife(awake, 1, 3, 2, [2, 3])).toThrow("raven_knife_unavailable");
  expect(() => selectRavenKnife(awake, 2, 3, 3, [2, 3])).toThrow("raven_knife_target_invalid");
  expect(() => selectRavenKnife(awake, 2, 3, 4, [2, 3])).toThrow("raven_knife_target_invalid");
  expect(readRavenState({ ...awake, extraHistory: [{ day: 1, targetId: null }] })).toBeUndefined();
  expect(readRavenState({ ...sealed, knownTeammateIds: [1] })).toBeUndefined();
});
test("state readers never execute getters or proxy traps, including nested arrays", () => {
  let called = 0;
  const accessor = {
    get policy() {
      called++;
      throw new Error("getter");
    },
  };
  expect(readAlchemistState(accessor)).toBeUndefined();
  expect(readRavenState(accessor)).toBeUndefined();
  const proxy = new Proxy(createAlchemistState(), {
    ownKeys() {
      called++;
      throw new Error("trap");
    },
  });
  expect(readAlchemistState(proxy)).toBeUndefined();
  const array: unknown[] = [];
  Object.defineProperty(array, "0", {
    get() {
      called++;
      throw new Error("arraygetter");
    },
    enumerable: true,
  });
  expect(readAlchemistState({ ...createAlchemistState(), mistHistory: array })).toBeUndefined();
  expect(readRavenState({ ...createRavenState(), knownTeammateIds: array })).toBeUndefined();
  expect(called).toBe(0);
});

test("unseal knowledge is at most one other wolf and cannot name the owner", () => {
  const invalid = {
    ...createRavenState(),
    awakenedDay: 2,
    knownTeammateIds: [1, 2, 4],
  };
  expect(readRavenState(invalid)).toBeUndefined();
  expect(() => unsealRaven(invalid, 3, 3, [3])).toThrow("raven_unseal_invalid");
  expect(() => selectRavenKnife(invalid, 3, 3, 4, [3, 4])).toThrow("raven_knife_unavailable");
  const self = { ...createRavenState(), awakenedDay: 2, knownTeammateIds: [3] };
  expect(() => unsealRaven(self, 3, 3, [3])).toThrow("raven_unseal_invalid");
  expect(() => selectRavenKnife(self, 3, 3, 4, [3, 4])).toThrow("raven_knife_unavailable");
});
