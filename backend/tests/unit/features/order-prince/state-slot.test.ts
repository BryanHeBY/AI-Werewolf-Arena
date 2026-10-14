/**
 * 单元测试验证定序王子槽的原赋值前缀、JSON查找／投影次序与提交后编码失败。
 * 输入为测试自有容器和JSON钩子、真实bootstrap的原角色；字面轨迹、引用和原错误是预期。
 * 数据样本不冒schema已接受任意setter；最后一例仅执行原权威选择，不运行完整周期、投票、模型或档案。
 * 写入不退款，原体／生命／pending仍归authority，知识副本及方法表不提供重投许可。
 */
import { expect, test } from "bun:test";
import type { OrderPrinceState } from "@ai-werewolf-arena/game-contract/facts/order-prince";
import { Camp, Role, WinCondition, type RoleComponent } from "../../../../src/core";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { ORDER_PRINCE_STATE_SLOT as SLOT } from "../../../../src/game/mechanisms/roles/order_prince/state-slot";
import { openOrderPrinceChoice, commitOrderPrinceChoice, orderPrinceChoicePending } from "../../../../src/game/mechanisms/roles/order_prince/authority";

// worldless 数据样本只持显式 Camp 句柄，不建立 Role→World／Camp 回退。
const fixtureCamp = { camp: Camp.Good };
const currentCamp = () => fixtureCamp;

test("slot init and replacement keep the container receiver, next identity and throwing setter prefix", () => {
  const trace: string[] = [], fault = new Error("order_slot_setter_failure");
  let written: unknown, receiver: unknown;
  const container = Object.defineProperty({}, "orderPrince", {
    set(this: unknown, value: unknown) { receiver = this; written = value; trace.push("setter"); throw fault; },
  });
  expect(() => SLOT.install(() => (trace.push("container"), container))).toThrow(fault);
  expect(trace).toEqual(["container", "setter"]);
  expect(written).toEqual({ policy: "awa_order_prince_first_ballot_v1", history: [] });
  expect(receiver).toBe(container);
  const next: OrderPrinceState = { policy: "awa_order_prince_first_ballot_v1", history: [{ day: 1, activate: true }] };
  trace.length = 0;
  expect(() => SLOT.allowedWrites.replace(() => (trace.push("container"), container), next)).toThrow(fault);
  expect(trace).toEqual(["container", "setter"]);
  expect(written).toBe(next);
  expect(receiver).toBe(container);
});

test("projected expected data looks up stringify before the late role read and remains detached", () => {
  const trace: string[] = [], current = SLOT.create();
  const role = { role: "order_prince", privateState: { orderPrince: current } } as unknown as RoleComponent;
  const next: OrderPrinceState = { policy: "awa_order_prince_first_ballot_v1", history: [{ day: 1, activate: false }] };
  const original = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  let encoded: string, receiver: unknown;
  try {
    Reflect.defineProperty(JSON, "stringify", {
      configurable: true,
      get() {
        trace.push("callee");
        (role.privateState as { orderPrince: OrderPrinceState }).orderPrince = next;
        return function(this: unknown, value: unknown) { receiver = this; trace.push("call"); return original.value(value); };
      },
    });
    encoded = SLOT.checkpoint.projection(() => (trace.push("role"), role), currentCamp);
  } finally { Reflect.defineProperty(JSON, "stringify", original); }
  expect(trace).toEqual(["callee", "role", "call"]);
  expect(receiver).toBe(JSON);
  expect(JSON.parse(encoded)).toEqual(next);
  const projection = SLOT.project(role, currentCamp)!;
  projection.history[0]!.activate = true;
  expect(next.history).toEqual([{ day: 1, activate: false }]);
});

test("authority preserves the replaced state when expected encoding throws after the write", () => {
  const config = {
    ...sixPlayerMvpConfig,
    boardSize: 12,
    voting: { exilePolicy: "awa_one_pk_v1" as const },
    winConditions: [WinCondition.SlaughterSide],
    roleSetups: [{ role: Role.OrderPrince, count: 1 }, { role: Role.Wolf, count: 4 }, { role: Role.Villager, count: 4 }, { role: Role.Seer, count: 1 }, { role: Role.Witch, count: 1 }, { role: Role.Hunter, count: 1 }],
  };
  const { world } = bootstrapGame(config, { fixedRoles: [Role.OrderPrince, Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Villager, Role.Villager, Role.Seer, Role.Witch, Role.Hunter] });
  expect(openOrderPrinceChoice(world, 1)).toBe(1);
  const role = world.getComponent(1, COMPONENT.Role)!, oldState = SLOT.get(role, () => world.getComponent(1, COMPONENT.Camp))!;
  const original = JSON.stringify, fault = new Error("order_expected_encoding_failure");
  let passed: unknown, caught: unknown;
  try {
    JSON.stringify = function(value: unknown): string {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const state = value as Partial<OrderPrinceState>;
        if (state.policy === "awa_order_prince_first_ballot_v1" && state.history?.at(-1)?.activate === true) {
          passed = value;
          throw fault;
        }
      }
      return original(value);
    };
    try { commitOrderPrinceChoice(world, 1, 1, true); } catch (error) { caught = error; }
  } finally { JSON.stringify = original; }
  expect(caught).toBe(fault);
  expect(SLOT.get(role, () => world.getComponent(1, COMPONENT.Camp))).toBe(passed as OrderPrinceState);
  expect(SLOT.get(role, () => world.getComponent(1, COMPONENT.Camp))).not.toBe(oldState);
  expect(SLOT.get(role, () => world.getComponent(1, COMPONENT.Camp))?.history).toEqual([{ day: 1, activate: true }]);
  expect(() => orderPrinceChoicePending(world, 1, 1)).toThrow("order_prince_original_state_revoked");
});
