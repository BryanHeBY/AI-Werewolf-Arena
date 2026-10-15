/**
 * 单元测试验证具名贵族 Provider 返回故障的真实唯一 owner；输入为合法板子、原 Alive 与一份显式计划。
 * 独立字面版本、对象引用、次数和同一 Error 为预期，测试不靠第二次镜像写入制造 replay 一致。
 * 原生命替换先提交；必需记录晚错保前缀并永久关闭计划；原猎魔 v1 的独立路径仍由既有兼容用例核对。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Phase, type ActionRequest, type ToolCall } from "../../../src/domain";
import { aliveLifeVersion } from "../../../src/domain/components/alive";
import { NightFaultPlan } from "../../../src/engine/fault-plan";
import { readFaultPlan, type NobleRequestFaultPlan } from "../../../src/domain/fault-plan";
import { nobleTransportScenario } from "../../support/features/noble-secret-body/builders/transport-plan";

function fixture() {
  const scenario = nobleTransportScenario("expiry"),
    actorId = scenario.mapping.get(5)!,
    targetId = scenario.mapping.get(7)!;
  const game = bootstrapGame(scenario.board.config, { fixedRoles: scenario.roles, locale: "en" });
  const plan: NobleRequestFaultPlan = {
    version: "awa_noble_request_fault_plan_v1",
    steps: [
      {
        id: "noble_original_life_replaced",
        at: {
          day: 2,
          point: "after_provider_return",
          afterDecision: { actorId, stage: "secret_body", turn: 1 },
        },
        mutation: { kind: "replace_alive_component", playerId: targetId, alive: true },
      },
    ],
  };
  const request: ActionRequest = {
    actorId,
    phase: Phase.Night,
    allowedTools: ["protect_secret_body"],
    context: {
      day: 2,
      stage: "secret_body",
      visible_events: [],
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
    },
  };
  const action: ToolCall = { name: "protect_secret_body", args: { target_id: targetId } };
  return { ...game, actorId, targetId, plan, request, action };
}

test("one explicit original-life replacement records its cause at the matching normal return only", () => {
  const f = fixture(),
    original = f.world.getComponent(f.targetId, COMPONENT.Alive)!,
    owner = new NightFaultPlan(f.world, f.plan, true),
    captured: unknown[] = [];
  expect(aliveLifeVersion(original)).toBe(0);
  owner.applyAfterProviderReturn({ ...f.request, actorId: f.targetId }, f.action, (fault) => {
    captured.push(fault);
  });
  expect(f.world.getComponent(f.targetId, COMPONENT.Alive)).toBe(original);
  expect(captured).toEqual([]);
  owner.applyAfterProviderReturn(f.request, f.action, (fault) => {
    captured.push(fault);
  });
  const replacement = f.world.getComponent(f.targetId, COMPONENT.Alive)!;
  expect(replacement).not.toBe(original);
  expect(replacement.alive).toBe(true);
  expect(aliveLifeVersion(replacement)).toBe(0);
  expect(captured).toEqual([{ step: f.plan.steps[0], originalVersion: 0, replacementVersion: 0 }]);
  expect(owner.plan).not.toBe(f.plan);
  expect(Object.isFrozen(owner.plan)).toBe(true);
  expect(() => owner.assertConsumed()).not.toThrow();
  expect(() => owner.applyAfterProviderReturn(f.request, f.action, () => {})).toThrow(
    "fault_plan_boundary_repeated",
  );
  expect(f.world.getComponent(f.targetId, COMPONENT.Alive)).toBe(replacement);
  expect(() => readFaultPlan({ ...f.plan, steps: [...f.plan.steps, ...f.plan.steps] })).toThrow();
  expect(() => new NightFaultPlan(f.world, f.plan)).toThrow("fault_plan_noble_board_required");
});

test("required causal-record failure preserves the real replacement and same error without a second mutation", () => {
  const f = fixture(),
    original = f.world.getComponent(f.targetId, COMPONENT.Alive)!,
    owner = new NightFaultPlan(f.world, f.plan, true),
    error = new Error("literal_noble_fault_record_failure");
  let caught: unknown;
  try {
    owner.applyAfterProviderReturn(f.request, f.action, () => {
      throw error;
    });
  } catch (failure) {
    caught = failure;
  }
  expect(caught).toBe(error);
  const replacement = f.world.getComponent(f.targetId, COMPONENT.Alive)!;
  expect(replacement).not.toBe(original);
  expect(replacement.alive).toBe(true);
  expect(() => owner.applyAfterProviderReturn(f.request, f.action, () => {})).toThrow(
    "fault_plan_failed",
  );
  expect(f.world.getComponent(f.targetId, COMPONENT.Alive)).toBe(replacement);
});
