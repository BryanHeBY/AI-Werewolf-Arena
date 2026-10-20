/**
 * Animal Dream state 单元测试使用既有内存夹具、原回调和显式坏变体，在原生 owner／frame／reader 边界隔离核对。原字面预期、身份快照及拒绝断言为依据，不重新生成；不装配游戏循环、不运行模型或实体传输，保留支持文件、夹具字节、政策及状态。
 */
import { expect, test } from "bun:test";
import {
  freshFoxCubState,
  payFoxCubChoice,
  freshPufferfishState,
  payPufferfishChoice,
  notePufferfishKnifeDeath,
  freshWhiteCatState,
  deferWhiteCat,
  expireWhiteCat,
  readWhiteCatState,
  readFoxCubState,
} from "../../../../src/features/animal-dream/state";

test("Fox starts N2; a deliberate pass keeps its one payment available", () => {
  const fresh = freshFoxCubState();
  expect(() => payFoxCubChoice(fresh, 1, 4)).toThrow();
  const passed = payFoxCubChoice(fresh, 2, null);
  expect(passed).toEqual({
    policy: "awa_animal_dream_v1",
    usedNight: null,
    history: [{ day: 2, targetId: null }],
  });
  const paid = payFoxCubChoice(passed, 3, 4);
  expect(paid).toEqual({
    policy: "awa_animal_dream_v1",
    usedNight: 3,
    history: [
      { day: 2, targetId: null },
      { day: 3, targetId: 4 },
    ],
  });
  expect(() => payFoxCubChoice(paid, 4, null)).toThrow();
  expect(fresh).toEqual({
    policy: "awa_animal_dream_v1",
    usedNight: null,
    history: [],
  });
});
test("Puffer active payment does not consume its independent future knife-death passive", () => {
  const passed = payPufferfishChoice(freshPufferfishState(), 1, false, [2, 4]);
  const paid = payPufferfishChoice(passed, 2, true, [3, 8]);
  const dead = notePufferfishKnifeDeath(paid, 3);
  expect(dead).toEqual({
    policy: "awa_animal_dream_v1",
    usedDay: 2,
    knifeDeathDay: 3,
    history: [
      { day: 1, activate: false, targetIds: [2, 4] },
      { day: 2, activate: true, targetIds: [3, 8] },
    ],
  });
  expect(() => payPufferfishChoice(passed, 2, true, [])).toThrow();
  expect(() => payPufferfishChoice(passed, 2, true, [4, 4])).toThrow();
  expect(() => payPufferfishChoice(dead, 4, false, [5])).toThrow();
  expect(() => notePufferfishKnifeDeath(paid, 1)).toThrow();
  expect(() => notePufferfishKnifeDeath(paid, 2)).toThrow();
});
test("Cat deferred at first night expires after first completed exile including abstention", () => {
  const pending = deferWhiteCat(freshWhiteCatState(), 1, "night", ["wolf_kill"], 0, null);
  expect(pending).toEqual({
    policy: "awa_animal_dream_v1",
    form: {
      kind: "deferred",
      deferred: {
        day: 1,
        phase: "night",
        firstSources: ["wolf_kill"],
        firstUnit: null,
        expiresAfterUnit: 1,
      },
    },
  });
  expect(
    expireWhiteCat(pending, { number: 1, day: 1, kind: "exile" }, "awa_wait_for_actual_exile_v1")
      .form.kind,
  ).toBe("expired");
  expect(deferWhiteCat(pending, 2, "night", ["charm"], 0, null)).toEqual(pending);
});
test("Cat first hit during current exile survives that whole unit and expires next unit", () => {
  const pending = deferWhiteCat(
    freshWhiteCatState(),
    1,
    "voting",
    ["exile", "puffer_retaliation"],
    0,
    { number: 1, day: 1, kind: "exile" },
  );
  expect(pending.form).toEqual({
    kind: "deferred",
    deferred: {
      day: 1,
      phase: "voting",
      firstSources: ["exile", "puffer_retaliation"],
      firstUnit: 1,
      expiresAfterUnit: 2,
    },
  });
  expect(
    expireWhiteCat(pending, { number: 1, day: 1, kind: "exile" }, "awa_wait_for_actual_exile_v1"),
  ).toEqual(pending);
  const expired = expireWhiteCat(
    pending,
    { number: 2, day: 2, kind: "exile" },
    "awa_wait_for_actual_exile_v1",
  );
  expect(expired.form).toEqual({
    kind: "expired",
    deferred: {
      day: 1,
      phase: "voting",
      firstSources: ["exile", "puffer_retaliation"],
      firstUnit: 1,
      expiresAfterUnit: 2,
    },
    day: 2,
    unit: 2,
    unitKind: "exile",
  });
});
test("skipped-day variants distinguish a Cat first revealed in the same combined wave", () => {
  const pending = deferWhiteCat(freshWhiteCatState(), 1, "night", ["wolf_kill"], 0, {
    number: 1,
    day: 1,
    kind: "skipped_day",
  });
  const unit = { number: 1, day: 1, kind: "skipped_day" } as const;
  expect(expireWhiteCat(pending, unit, "awa_wait_for_actual_exile_v1")).toEqual(pending);
  expect(expireWhiteCat(pending, unit, "awa_expire_on_skipped_day_v1").form.kind).toBe("expired");
});
test("state readers reject fabricated sources and execute no accessor", () => {
  const pending = deferWhiteCat(freshWhiteCatState(), 1, "night", ["wolf_kill"], 0, null);
  expect(() =>
    readWhiteCatState({
      ...pending,
      form: {
        kind: "deferred",
        deferred: {
          day: 1,
          phase: "night",
          firstSources: ["fake"],
          firstUnit: null,
          expiresAfterUnit: 1,
        },
      },
    }),
  ).toThrow();
  let calls = 0;
  const bad = Object.defineProperty({ ...freshFoxCubState() }, "usedNight", {
    enumerable: true,
    get() {
      calls++;
      return null;
    },
  });
  expect(() => readFoxCubState(bad)).toThrow();
  expect(calls).toBe(0);
});
test("a historical skipped unit cannot precede Cat first deferral", () => {
  const pending = deferWhiteCat(freshWhiteCatState(), 3, "voting", ["exile"], 4, {
    number: 5,
    day: 3,
    kind: "exile",
  });
  expect(
    expireWhiteCat(
      pending,
      { number: 1, day: 3, kind: "skipped_day" },
      "awa_expire_on_skipped_day_v1",
    ),
  ).toEqual(pending);
  if (pending.form.kind !== "deferred") throw Error("test_fixture_invalid");
  const deferred = pending.form.deferred;
  expect(() =>
    readWhiteCatState({
      policy: "awa_animal_dream_v1",
      form: {
        kind: "expired",
        deferred,
        day: 3,
        unit: 1,
        unitKind: "skipped_day",
      },
    }),
  ).toThrow();
});
test("Cat payment reads inert own data and never executes an external iterator or unit getter", () => {
  let calls = 0;
  const raw = ["wolf_kill"];
  Object.defineProperty(raw, Symbol.iterator, {
    value: function* () {
      calls++;
      yield "exile";
    },
  });
  expect(() => deferWhiteCat(freshWhiteCatState(), 1, "night", raw, 0, null)).toThrow();
  const unit = Object.defineProperty({ number: 1, day: 1, kind: "exile" }, "number", {
    enumerable: true,
    get() {
      calls++;
      return 1;
    },
  }) as any;
  expect(() => deferWhiteCat(freshWhiteCatState(), 1, "voting", ["exile"], 0, unit)).toThrow();
  const pending = deferWhiteCat(freshWhiteCatState(), 1, "night", ["wolf_kill"], 0, null);
  expect(() => expireWhiteCat(pending, unit, "awa_wait_for_actual_exile_v1")).toThrow();
  expect(calls).toBe(0);
});
test("long legitimate pass histories retain unused resources beyond sixty nights", () => {
  let fox = freshFoxCubState(),
    puffer = freshPufferfishState();
  for (let day = 1; day <= 81; day++) {
    fox = payFoxCubChoice(fox, day + 1, null);
    puffer = payPufferfishChoice(puffer, day, false, [2, 3]);
  }
  expect(fox.usedNight).toBeNull();
  expect(fox.history.length).toBe(81);
  expect(puffer.usedDay).toBeNull();
  expect(puffer.history.length).toBe(81);
});
