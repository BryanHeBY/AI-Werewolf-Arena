/**
 * 负责觉醒狼美人未启用基础库存的单元测试。手写历史／付款预期验证原安装身份、CAS、单调资源及零getter；
 * 不注册新Role，不把本层状态验收当夜间行为或真实替死交付。
 */
import { expect, test } from "bun:test";
import { Role, Phase, DeathCause } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_BEAUTY_POLICY } from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import { createRoleComponent } from "../../../../src/domain/components/role";
import {
  initializeAwakenedBeautyState,
  getAwakenedBeautyState,
  prepareAwakenedBeautyState,
  replaceAwakenedBeautyState,
} from "../../../../src/features/awakened-wolf-beauty/state";
test("只有原安装槽持库存，拒相同JSON和撤权后恢复旧引用", () => {
  const role = createRoleComponent(Role.Wolf);
  initializeAwakenedBeautyState(role);
  const original = getAwakenedBeautyState(role)!;
  expect(Object.isFrozen(original)).toBe(true);
  Reflect.set(role.privateState, "awakenedBeauty", structuredClone(original));
  expect(getAwakenedBeautyState(role)).toBeUndefined();
  Reflect.set(role.privateState, "awakenedBeauty", original);
  expect(getAwakenedBeautyState(role)).toBeUndefined();
});
test("选择追加后只付款一次，旧expected与回退历史均拒绝", () => {
  const role = createRoleComponent(Role.Wolf);
  initializeAwakenedBeautyState(role);
  const initial = getAwakenedBeautyState(role)!,
    chosen = prepareAwakenedBeautyState({ ...initial, choices: [{ day: 1, targetId: 2 }] });
  replaceAwakenedBeautyState(role, initial, chosen);
  expect(() => replaceAwakenedBeautyState(role, initial, chosen)).toThrow(
    "awakened_beauty_state_revoked",
  );
  expect(() => replaceAwakenedBeautyState(role, chosen, initial)).toThrow(
    "awakened_beauty_state_transition_invalid",
  );
  const paid = prepareAwakenedBeautyState({
    ...chosen,
    replacement: {
      day: 1,
      phase: Phase.Day,
      rootPhase: Phase.Night,
      targetId: 2,
      preventedCauses: [DeathCause.Poison],
    },
  });
  replaceAwakenedBeautyState(role, chosen, paid);
  expect(() => replaceAwakenedBeautyState(role, paid, chosen)).toThrow(
    "awakened_beauty_state_transition_invalid",
  );
  expect(getAwakenedBeautyState(role)).toBe(paid);
});
test("已有undefined或访问器槽均原样拒绝且零执行", () => {
  let reads = 0;
  for (const descriptor of [
    { value: undefined },
    {
      get() {
        reads++;
        return undefined;
      },
    },
  ]) {
    const role = createRoleComponent(Role.Wolf);
    Object.defineProperty(role.privateState, "awakenedBeauty", descriptor);
    expect(() => initializeAwakenedBeautyState(role)).toThrow(
      "awakened_beauty_state_install_invalid",
    );
    expect(Object.getOwnPropertyDescriptor(role.privateState, "awakenedBeauty")).toEqual({
      ...descriptor,
      enumerable: false,
      configurable: false,
      ...("value" in descriptor ? { writable: false } : { set: undefined }),
    });
  }
  expect(reads).toBe(0);
  expect(
    prepareAwakenedBeautyState({ policy: AWAKENED_BEAUTY_POLICY, choices: [], replacement: null })
      .replacement,
  ).toBeNull();
});
