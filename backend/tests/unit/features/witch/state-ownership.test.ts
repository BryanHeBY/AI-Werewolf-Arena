/**
 * 单元测试：验证普通女巫 payload 写所有权。输入为字面原生状态与对抗性 setter／day／state getter；手写读写日志、原错误身份及未改能力元数据为预期。具体 payload 命令不替代 claim、标记、租约校验或独立审计推断。
 */
import type { WitchState } from "@ai-werewolf-arena/game-contract";

import { expect, test } from "bun:test";
import { Role, Camp, WitchSelfHealRule } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import {
  resetWitchNightState,
  refreshWitchSelfHeal,
  consumeWitchHeal,
  consumeWitchPoison,
  consumeRecipientPoison,
} from "../../../../src/game/mechanisms/roles/witch/ports";
import { setWitchState } from "../../../../src/game/mechanisms/roles/witch/ports";

function state(rule = WitchSelfHealRule.FirstNightOnly): WitchState {
  return {
    heal: 1,
    poison: 1,
    selfHealRule: rule,
    canSelfHeal: false,
    healUsedThisNight: true,
    poisonUsedThisNight: true,
  };
}
test("reset day failure keeps both preceding flag writes and does not overwrite self-heal", () => {
  const s = state(),
    failure = new Error("witch_day_failed"),
    log: unknown[] = [];
  Object.defineProperty(s, "healUsedThisNight", {
    set(value) {
      log.push(["heal", value]);
    },
  });
  Object.defineProperty(s, "poisonUsedThisNight", {
    set(value) {
      log.push(["poison", value]);
    },
  });
  let caught: unknown;
  try {
    resetWitchNightState(s, () => {
      log.push("day");
      throw failure;
    });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(log).toEqual([["heal", false], ["poison", false], "day"]);
  expect(s.canSelfHeal).toBe(false);
});
test("always-self-heal reset keeps the day callback unevaluated", () => {
  const s = state(WitchSelfHealRule.Always);
  resetWitchNightState(s, () => {
    throw new Error("day_must_not_be_read");
  });
  expect(s.canSelfHeal).toBe(true);
  expect([s.healUsedThisNight, s.poisonUsedThisNight]).toEqual([false, false]);
});
for (const [potion, consume] of [
  ["heal", consumeWitchHeal],
  ["poison", consumeWitchPoison],
] as const)
  test(`${potion}: flag setter failure preserves already-decremented stock and original error`, () => {
    const s = state(),
      failure = new Error("potion_flag_failed");
    Object.defineProperty(s, potion === "heal" ? "healUsedThisNight" : "poisonUsedThisNight", {
      set() {
        throw failure;
      },
    });
    let caught: unknown;
    try {
      consume(s);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(s[potion]).toBe(0);
    expect(s[potion === "heal" ? "poison" : "heal"]).toBe(1);
  });
test("self-heal refresh writes the original LHS slot despite changing RHS state getters", () => {
  const role = createRoleComponent(Role.Witch, "en"),
    original = setWitchState(role, state()),
    ability = findNightAbility(role, "potion")!,
    replacement = state(WitchSelfHealRule.Always),
    log: number[] = [];
  Object.defineProperty(ability, "state", {
    get() {
      log.push(log.length + 1);
      return log.length === 1 ? original : replacement;
    },
  });
  refreshWitchSelfHeal(ability, 2);
  expect(log).toEqual([1, 2]);
  expect(original.canSelfHeal).toBe(true);
  expect(replacement.canSelfHeal).toBe(false);
});
test("recipient postfix payment retains two state reads and leaves use accounting to the caller", () => {
  const role = createRoleComponent(Role.Witch, "en"),
    first = setWitchState(role, state()),
    ability = findNightAbility(role, "potion")!,
    second = state(),
    log: number[] = [];
  Object.defineProperty(ability, "state", {
    get() {
      log.push(log.length + 1);
      return log.length === 1 ? first : second;
    },
  });
  second.poisonUsedThisNight = false;
  consumeRecipientPoison(ability);
  expect(log).toEqual([1, 2]);
  expect(first.poison).toBe(0);
  expect(second.poison).toBe(1);
  expect(second.poisonUsedThisNight).toBe(true);
  expect(ability.uses).toBe(0);
  expect(ability.lastUsedDay).toBe(null);
});
