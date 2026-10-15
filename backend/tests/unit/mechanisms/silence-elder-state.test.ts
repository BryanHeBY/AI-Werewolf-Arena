/**
 * 负责禁言长老尚未启用的数据槽单元测试，按独立字面预期验证原引用写权、恶意访问器拒绝与脱离知识。
 * 输入用稳定资料 ID 构造低层角色数据，只验证槽，不把构造数据当成板子或运行注册。
 */
import { expect, test } from "bun:test";
import { SILENCE_ELDER_ROLE_ID } from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { Role } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../src/domain/components/role";
import {
  initializeSilenceElderState,
  getSilenceElderState,
  projectSilenceElderState,
  nextSilenceElderChoice,
  replaceSilenceElderState,
} from "../../../src/features/silence-elder/state";

function initial() {
  const role = createRoleComponent(SILENCE_ELDER_ROLE_ID as Role);
  initializeSilenceElderState(role);
  return role;
}

test("only the owning slot replaces the captured state; clones and repeated installation cannot overwrite it", () => {
  const role = initial(),
    first = getSilenceElderState(role)!;
  expect(first.history).toEqual([]);
  expect(Object.isFrozen(first)).toBe(true);
  expect(() => initializeSilenceElderState(role)).toThrow("silence_elder_state_install_invalid");
  const next = nextSilenceElderChoice(first, { day: 1, targetId: 2, translatorId: 3 });
  expect(getSilenceElderState(role)).toBe(first);
  expect(() => replaceSilenceElderState(role, structuredClone(first), next)).toThrow(
    "silence_elder_state_revoked",
  );
  replaceSilenceElderState(role, first, next);
  expect(getSilenceElderState(role)).toBe(next);
  expect(() => replaceSilenceElderState(role, first, next)).toThrow("silence_elder_state_revoked");
});

test("published knowledge is detached and never creates live history writes", () => {
  const role = initial(),
    first = getSilenceElderState(role)!,
    next = nextSilenceElderChoice(first, { day: 1, targetId: 2, translatorId: null });
  replaceSilenceElderState(role, first, next);
  const view = projectSilenceElderState(role)!;
  expect(view).toEqual(next);
  expect(view).not.toBe(next);
  expect(view.history[0]).not.toBe(next.history[0]);
  (view.history[0] as { targetId: number }).targetId = 99;
  expect(getSilenceElderState(role)!.history[0]!.targetId).toBe(2);
  expect(() => nextSilenceElderChoice(next, { day: 1, targetId: 4, translatorId: null })).toThrow(
    "silence_elder_choice_history_invalid",
  );
});

test("installation rejects every occupied own slot, including undefined and an accessor", () => {
  let reads = 0;
  for (const descriptor of [
    { value: undefined, writable: true, configurable: true },
    {
      get() {
        reads++;
        throw Error("unexpected_install_getter");
      },
      configurable: true,
    },
  ]) {
    const role = createRoleComponent(SILENCE_ELDER_ROLE_ID as Role);
    Object.defineProperty(role.privateState, "silenceElder", descriptor);
    const original = Object.getOwnPropertyDescriptor(role.privateState, "silenceElder");
    expect(() => initializeSilenceElderState(role)).toThrow("silence_elder_state_install_invalid");
    expect(Object.getOwnPropertyDescriptor(role.privateState, "silenceElder")).toEqual(original);
  }
  expect(reads).toBe(0);
});

test("state and private container accessors never execute during a read", () => {
  let reads = 0;
  const role = initial();
  Object.defineProperty(role.privateState, "silenceElder", {
    get() {
      reads++;
      throw Error("unexpected_state_getter");
    },
    configurable: true,
  });
  expect(getSilenceElderState(role)).toBeUndefined();
  Object.defineProperty(role, "privateState", {
    get() {
      reads++;
      throw Error("unexpected_container_getter");
    },
  });
  expect(getSilenceElderState(role)).toBeUndefined();
  expect(reads).toBe(0);
});

test("frozen or replaced data fields reject writes without touching the proposed next state", () => {
  const role = initial(),
    old = getSilenceElderState(role)!,
    next = nextSilenceElderChoice(old, { day: 1, targetId: 2, translatorId: null });
  Object.freeze(role.privateState);
  expect(() => replaceSilenceElderState(role, old, next)).toThrow("silence_elder_state_revoked");
  expect(getSilenceElderState(role)).toBe(old);
  expect(next.history).toEqual([{ day: 1, targetId: 2, translatorId: null }]);
});

test("a Node Proxy is rejected before its reflection hooks run", () => {
  let calls = 0;
  const value = new Proxy(initial(), {
    get() {
      calls++;
      throw Error("unexpected_get");
    },
    getOwnPropertyDescriptor() {
      calls++;
      throw Error("unexpected_descriptor");
    },
  });
  expect(getSilenceElderState(value)).toBeUndefined();
  expect(calls).toBe(0);
});
