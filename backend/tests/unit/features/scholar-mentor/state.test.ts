/**
 * 单元测试验证白昼学者／寂夜导师原状态复制、一次库存／历史和有限板碰撞规则。
 * 输入为原内存 fixture、明确非法修改和控制表；原字面预期／引用及拒绝断言不在迁移中生成。
 * 仅调用本族 state-slot／rules，不装配完整对局、模型或真实传输；原支持表、title 与动作保持。
 */
import type {
  ModifierCaster,
  ModifierMode,
  ModifierPlayer,
  CommittedModifier,
} from "@ai-werewolf-arena/game-contract";
import { expect, test } from "bun:test";
import {
  createModifierState,
  readModifierState,
  selectModifier,
} from "../../../../src/game/mechanisms/roles/scholar_mentor/state-slot";
import { resolveModifiers } from "../../../../src/game/mechanisms/roles/scholar_mentor/rules";
const roster: ModifierPlayer[] = [
  { id: 1, role: "day_scholar", camp: "good", alive: true },
  { id: 2, role: "night_mentor", camp: "wolf", alive: true },
  { id: 3, role: "seer", camp: "good", alive: true },
  { id: 4, role: "guard", camp: "good", alive: true },
  { id: 5, role: "witch", camp: "good", alive: true },
  ...[6, 7, 8].map((id) => ({ id, role: "wolf", camp: "wolf" as const, alive: true })),
  ...[9, 10, 11, 12].map((id) => ({ id, role: "villager", camp: "good" as const, alive: true })),
];
const ids = roster.map((p) => p.id);
const cast = (
  caster: ModifierCaster,
  targetId: number,
  mode: ModifierMode = "enhance",
): CommittedModifier => ({ actorId: caster === "day_scholar" ? 1 : 2, caster, targetId, mode });
for (const caster of ["day_scholar", "night_mentor"] as const) {
  test("Modifier finite charges and pure selection/" + caster, () => {
    const initial = createModifierState(caster);
    expect(readModifierState(initial)).toEqual(initial);
    expect(() => selectModifier(initial, 1, "enhance", 3, ids)).toThrow();
    const first = selectModifier(initial, 2, "enhance", 3, ids);
    expect(initial.remaining).toEqual({ enhance: 1, weaken: 1 });
    expect(first.remaining).toEqual({ enhance: 0, weaken: 1 });
    expect(() => selectModifier(first, 3, "enhance", 4, ids)).toThrow("modifier_charge_spent");
    expect(() => selectModifier(first, 2, "weaken", 4, ids)).toThrow("modifier_choice_day_invalid");
    const second = selectModifier(first, 3, "weaken", 4, ids);
    expect(second.remaining).toEqual({ enhance: 0, weaken: 0 });
    expect(readModifierState(second)).toEqual(second);
    expect(() => selectModifier(second, 4, "weaken", 5, ids)).toThrow("modifier_charge_spent");
  });
  test("Modifier explicit pass, self target, invalid target/" + caster, () => {
    const initial = createModifierState(caster);
    const pass = selectModifier(initial, 2, null, null, ids);
    expect(pass.remaining).toEqual(initial.remaining);
    const self = selectModifier(pass, 3, "enhance", caster === "day_scholar" ? 1 : 2, ids);
    expect(self.remaining.enhance).toBe(0);
    expect(() => selectModifier(initial, 2, null, 3, ids)).toThrow();
    expect(() => selectModifier(initial, 2, "weaken", 999, ids)).toThrow();
    expect(() => selectModifier(initial, 2, "weaken", -1, [-1, ...ids])).toThrow();
  });
  test("Modifier state rejects forged resources/history/" + caster, () => {
    const state = selectModifier(createModifierState(caster), 2, "enhance", 3, ids);
    expect(readModifierState({ ...state, remaining: { enhance: 1, weaken: 1 } })).toBeUndefined();
    expect(
      readModifierState({ ...state, history: [...state.history, ...state.history] }),
    ).toBeUndefined();
    expect(readModifierState({ ...state, extra: true })).toBeUndefined();
    expect(readModifierState({ ...state, policy: "foreign" })).toBeUndefined();
    const restored = readModifierState(state)!;
    restored.history[0]!.targetId = 4;
    expect(state.history[0]!.targetId).toBe(3);
  });
}
for (const first of ["enhance", "weaken"] as const)
  for (const second of ["enhance", "weaken"] as const) {
    test("Modifier same good conflict/" + first + "/" + second, () => {
      const result = resolveModifiers(roster, [
        cast("day_scholar", 3, first),
        cast("night_mentor", 3, second),
      ]);
      expect(result).toEqual({
        pendingDeaths: [3],
        conflict: "same_good",
        goodEffects: [],
        bonusKnifeActorId: null,
        blockWolfKnife: false,
      });
      expect(roster.find((p) => p.id === 3)!.alive).toBe(true);
    });
    test("Modifier two wolves conflict/" + first + "/" + second, () => {
      for (const other of [6, 7]) {
        const result = resolveModifiers(roster, [
          cast("day_scholar", 6, first),
          cast("night_mentor", other, second),
        ]);
        expect(result.pendingDeaths).toEqual([2]);
        expect(result.conflict).toBe("both_wolves");
        expect(result.bonusKnifeActorId).toBeNull();
        expect(result.blockWolfKnife).toBe(false);
      }
    });
  }
test("Modifier immune caster filtering precedes conflict", () => {
  for (const target of [1, 2]) {
    const result = resolveModifiers(roster, [
      cast("day_scholar", target),
      cast("night_mentor", 6, "weaken"),
    ]);
    expect(result.pendingDeaths).toEqual([]);
    expect(result.blockWolfKnife).toBe(true);
  }
  const both = resolveModifiers(roster, [cast("day_scholar", 2), cast("night_mentor", 1)]);
  expect(both.goodEffects).toEqual([]);
  expect(both.pendingDeaths).toEqual([]);
});
test("Modifier ordinary villagers ignored except same-good collision", () => {
  expect(resolveModifiers(roster, [cast("day_scholar", 9)]).goodEffects).toEqual([]);
  expect(
    resolveModifiers(roster, [cast("day_scholar", 9), cast("night_mentor", 9)]).pendingDeaths,
  ).toEqual([9]);
});
test("Modifier separate native effects and pack outcomes", () => {
  const result = resolveModifiers(roster, [
    cast("day_scholar", 4),
    cast("night_mentor", 5, "weaken"),
  ]);
  expect(result.goodEffects).toEqual([
    { targetId: 4, role: "guard", mode: "enhance" },
    { targetId: 5, role: "witch", mode: "weaken" },
  ]);
  expect(resolveModifiers(roster, [cast("day_scholar", 6)]).bonusKnifeActorId).toBe(6);
  expect(resolveModifiers(roster, [cast("night_mentor", 6, "weaken")]).blockWolfKnife).toBe(true);
});
test("Modifier rejects replaced actors, dead targets and foreign roster", () => {
  expect(() =>
    resolveModifiers(roster, [cast("day_scholar", 3), cast("day_scholar", 4)]),
  ).toThrow();
  expect(() => resolveModifiers(roster, [{ ...cast("night_mentor", 3), actorId: 1 }])).toThrow();
  expect(() =>
    resolveModifiers(
      roster.map((p) => (p.id === 3 ? { ...p, alive: false } : p)),
      [cast("day_scholar", 3)],
    ),
  ).toThrow();
  expect(() =>
    resolveModifiers(
      roster.map((p) => (p.id === 6 ? { ...p, role: "magician" } : p)),
      [],
    ),
  ).toThrow();
  expect(() => resolveModifiers([...roster, roster[0]!], [])).toThrow();
});

for (const caster of ["day_scholar", "night_mentor"] as const)
  for (const mutation of [
    "root-getter",
    "remaining-getter",
    "row-getter",
    "array-getter",
    "sparse-history",
    "symbol-field",
    "proxy",
  ] as const)
    test("Modifier reader rejects non-data authority/" + caster + "/" + mutation, () => {
      let state: unknown = selectModifier(createModifierState(caster), 2, "enhance", 3, ids);
      const obj = state as ReturnType<typeof createModifierState>;
      let called = false;
      const getter = () => {
        called = true;
        throw new Error("must_not_execute_getter");
      };
      if (mutation === "root-getter") Object.defineProperty(obj, "policy", { get: getter });
      else if (mutation === "remaining-getter")
        Object.defineProperty(obj.remaining, "enhance", { get: getter });
      else if (mutation === "row-getter")
        Object.defineProperty(obj.history[0]!, "targetId", { get: getter });
      else if (mutation === "array-getter")
        Object.defineProperty(obj.history, "0", { get: getter });
      else if (mutation === "sparse-history") delete obj.history[0];
      else if (mutation === "symbol-field")
        Object.defineProperty(obj, Symbol("extra"), { value: true });
      else
        state = new Proxy(obj, {
          ownKeys: () => {
            called = true;
            throw new Error("must_not_execute_proxy");
          },
        });
      expect(readModifierState(state)).toBeUndefined();
      expect(called).toBe(false);
    });
test("Modifier safe day bounds and caster identity", () => {
  expect(() => createModifierState("wolf" as ModifierCaster)).toThrow("modifier_caster_invalid");
  expect(() =>
    selectModifier(createModifierState("day_scholar"), Number.MAX_SAFE_INTEGER, null, null, ids),
  ).toThrow("modifier_choice_day_invalid");
});
