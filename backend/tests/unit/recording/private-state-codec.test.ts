/**
 * 单元测试验证私有状态编码的普通整容器克隆和原 callee／getter 失败顺序。
 * 输入是独立手工角色、共享引用与合法 getter；字面引用关系、读取轨迹及同一错误是预期，
 * 不从另一个生产编码器生成答案。测试只控制自有状态及临时 clone 查找，finally 恢复全局字段；
 * 宽克隆结果不等于后续 JSON 归档接受或行动授权，不推进对局、不写档案或调用模型。
 */
import { expect, test } from "bun:test";
import { Role, Camp } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { createRoleComponent } from "../../../src/domain/components/role";
import { encodeCheckpointPrivateState } from "../../../src/recording/checkpoint/private-state-codec";

test("ordinary codec keeps full-container aliases, cycles, undefined and legal getter values", () => {
  const world = new World("en"),
    role = createRoleComponent(Role.Villager),
    shared = { amount: 2 },
    reads: string[] = [],
    container: Record<string, unknown> = {
      left: shared,
      right: shared,
      optional: undefined,
      get legal() {
        reads.push("legal-getter");
        return shared;
      },
    };
  container.self = container;
  Object.defineProperty(role, "privateState", { value: container });
  const result = encodeCheckpointPrivateState(world, 1, true, null, null, role, null);
  expect(reads).toEqual(["legal-getter"]);
  expect(result).not.toBe(container);
  expect(result.left).not.toBe(shared);
  expect(result.left).toBe(result.right);
  expect(result.legal).toBe(result.left);
  expect(result.self).toBe(result);
  expect(Object.hasOwn(result, "optional")).toBe(true);
  expect(result.optional).toBeUndefined();
  expect(result.left).toEqual({ amount: 2 });
});

test("ordinary codec finds clone callee before private-state getter and preserves its failure", () => {
  const world = new World("en"),
    role = createRoleComponent(Role.Villager),
    trace: string[] = [],
    failure = new Error("test_private_state_getter_failed"),
    cloneDescriptor = Object.getOwnPropertyDescriptor(globalThis, "structuredClone")!;
  Object.defineProperty(role, "privateState", {
    get() {
      trace.push("private-state");
      throw failure;
    },
  });
  // 只在本案例将原全局可配置字段换为查找探针；getter 抛错前不得进入 clone 调用。
  Object.defineProperty(globalThis, "structuredClone", {
    configurable: true,
    get() {
      trace.push("clone-callee");
      return () => {
        trace.push("clone-call");
        throw new Error("unexpected_clone_call");
      };
    },
  });
  let caught: unknown;
  try {
    encodeCheckpointPrivateState(world, 1, false, null, null, role, null);
  } catch (error) {
    caught = error;
  } finally {
    Object.defineProperty(globalThis, "structuredClone", cloneDescriptor);
  }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["clone-callee", "private-state"]);
});
