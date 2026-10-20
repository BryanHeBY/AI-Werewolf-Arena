/**
 * 负责觉醒猎人未启用基础库存的单元测试。独立字面预期核单个方向单位、明确空过及替换撤权，
 * 不注册新Role或复用普通Hunter枪，不把纯状态付款当真实巡猎死亡。
 */
import { expect, test } from "bun:test";
import { Role, Phase } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../../src/domain/components/role";
import {
  initializeAwakenedPatrolState,
  getAwakenedPatrolState,
  prepareAwakenedPatrolState,
  replaceAwakenedPatrolState,
} from "../../../../src/features/awakened-hunter/state";
test("null方向是实际唯一付款，不能再次付款或恢复ready", () => {
  const role = createRoleComponent(Role.Hunter);
  initializeAwakenedPatrolState(role);
  const initial = getAwakenedPatrolState(role)!,
    paid = prepareAwakenedPatrolState({
      ...initial,
      payment: { day: 2, rootPhase: Phase.Night, direction: null, targetId: null },
    });
  replaceAwakenedPatrolState(role, initial, paid);
  expect(getAwakenedPatrolState(role)).toBe(paid);
  expect(() => replaceAwakenedPatrolState(role, paid, initial)).toThrow(
    "awakened_patrol_state_transition_invalid",
  );
  expect(() => replaceAwakenedPatrolState(role, initial, paid)).toThrow(
    "awakened_patrol_state_revoked",
  );
});
test("同形JSON不能安装库存，原slot观察撤换后不可恢复", () => {
  const role = createRoleComponent(Role.Hunter);
  initializeAwakenedPatrolState(role);
  const original = getAwakenedPatrolState(role)!;
  const clone = createRoleComponent(Role.Hunter);
  Reflect.set(clone.privateState, "awakenedPatrol", original);
  expect(getAwakenedPatrolState(clone)).toBeUndefined();
  Reflect.set(role.privateState, "awakenedPatrol", structuredClone(original));
  expect(getAwakenedPatrolState(role)).toBeUndefined();
  Reflect.set(role.privateState, "awakenedPatrol", original);
  expect(getAwakenedPatrolState(role)).toBeUndefined();
});
test("已有访问器不执行、不覆盖，拒第二次初始化", () => {
  const role = createRoleComponent(Role.Hunter);
  let reads = 0;
  Object.defineProperty(role.privateState, "awakenedPatrol", {
    get() {
      reads++;
      return undefined;
    },
  });
  expect(() => initializeAwakenedPatrolState(role)).toThrow();
  expect(reads).toBe(0);
  const valid = createRoleComponent(Role.Hunter);
  initializeAwakenedPatrolState(valid);
  expect(() => initializeAwakenedPatrolState(valid)).toThrow();
});
