/**
 * 单元测试：验证领域不透明角色容器及两个具体读所有者。输入为手写角色、槽 getter 和退休 ID 数组；getter 顺序、源身份、脱离输出和原错误为预期。编译期拒绝 core 索引，初始化仍允许扩展键；不运行对局、归档、传输或模型。
 */
import "../../../src/app/bootstrap";
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { type RoleComponent } from "../../../src/core/domain/components/role";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import type { RoleInitializationComponent } from "../../../src/game/mechanisms/roles/contracts";
import { projectEclipseState } from "../../../src/game/mechanisms/roles/radiant_eclipse/ports";
import { retiredNightAbilityIds } from "../../../src/game/mechanisms/roles/abilities";

function deniedCoreAccess(role: RoleComponent, init: RoleInitializationComponent) {
  // @ts-expect-error The core cannot name a feature's private field.
  void role.privateState.hunter;
  // @ts-expect-error The core has no implicit string-key storage view.
  void role.privateState["extension"];
  // @ts-expect-error Ordinary callers cannot replace the live container.
  role.privateState = {};
  init.privateState.extension = { custom: true };
  init.privateState = { anotherExtension: 1 };
}
void deniedCoreAccess;

test("Eclipse projection preserves original slot getter order and detached state", () => {
  const calls: string[] = [],
    state = { policy: "awa_radiant_eclipse_v1", history: [] },
    role = createRoleComponent(Role.EclipseMaid, Camp.Wolf);
  Object.defineProperty(role, "privateState", {
    get() {
      calls.push("privateState");
      return {
        get eclipse() {
          calls.push("eclipse");
          return state;
        },
      };
    },
  });
  const result = projectEclipseState(role)!;
  expect(calls).toEqual(["privateState", "eclipse"]);
  expect(result).toEqual({ policy: "awa_radiant_eclipse_v1", history: [] });
  expect(result).not.toBe(state);
  expect(result.history).not.toBe(state.history);
});

test("Eclipse slot failure stays before the existing detached reader", () => {
  const fault = new Error("literal_slot_failure"),
    role = createRoleComponent(Role.EclipseMaid, Camp.Wolf),
    trace: string[] = [];
  Object.defineProperty(role, "privateState", {
    value: {
      get eclipse() {
        trace.push("eclipse");
        throw fault;
      },
    },
  });
  let caught: unknown;
  try {
    projectEclipseState(role);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(fault);
  expect(trace).toEqual(["eclipse"]);
});

test("retired inventory query keeps the original list and fresh nullish fallback", () => {
  const role = createRoleComponent(Role.MirrorGirl, Camp.Good),
    original = ["native:role_check"],
    trace: string[] = [];
  Object.defineProperty(role, "privateState", {
    get() {
      trace.push("privateState");
      return {
        get retiredAbilityIds() {
          trace.push("retiredAbilityIds");
          return original;
        },
      };
    },
  });
  expect(retiredNightAbilityIds(role)).toBe(original);
  expect(trace).toEqual(["privateState", "retiredAbilityIds"]);
  const empty = createRoleComponent(Role.Villager, Camp.Good);
  const first = retiredNightAbilityIds(empty),
    second = retiredNightAbilityIds(empty);
  expect(first).toEqual([]);
  expect(second).toEqual([]);
  expect(first).not.toBe(second);
});
