/**
 * 单元测试负责核对执行反馈通道的身份、别名、取消和串行边界。输入为字面请求与受控任务，
 * 输出以拒绝、一次交付及明确中断为预期；不操作真实游戏资源，不授予复制对象领域许可。
 */
import { expect, test } from "bun:test";
import {
  openActionExecution,
  awaitActionExecution,
  deliverActionSelection,
} from "../../../src/domain/action-execution";
import { deriveBoundedRequest } from "../../../src/domain/request-delivery";
import { Phase, type ActionRequest, type ToolCall } from "../../../src/domain";
import { withActionExecutionScope } from "../../../src/engine/actions/action-execution-scope";

const request = (): ActionRequest => ({
  actorId: 1,
  phase: Phase.Night,
  allowedTools: ["check_identity"],
  context: { day: 1, stage: "seer", visible_events: [], turn_constraints: {} },
});
const action: ToolCall = { name: "check_identity", args: { target_id: 2 } };

test("只有合法期限别名继承反馈通道；JSON 复制、二次选择和结束后的调用不能重开通道", async () => {
  const req = request(),
    channel = openActionExecution(req, ["check_identity"]);
  expect(awaitActionExecution(structuredClone(req), action)).toBeUndefined();
  const alias = deriveBoundedRequest(req, Date.now() + 1000);
  const facts = awaitActionExecution(alias, action)!;
  const task = facts.then(() => action);
  expect(await deliverActionSelection(req, task)).toEqual(action);
  expect(() => awaitActionExecution(req, action)).toThrow("action_execution_already_selected");
  await channel.complete({ kind: "resolved", interrupted: false, events: [] });
  expect(await facts).toEqual({ kind: "resolved", interrupted: false, events: [] });
  expect(awaitActionExecution(alias, action)).toBeUndefined();
});

test("取消唤醒工具等待；已交出候选不会被撤回或再次选择", async () => {
  const req = request(),
    channel = openActionExecution(req, ["check_identity"]),
    controller = new AbortController();
  const facts = awaitActionExecution(req, action, controller.signal)!;
  const selection = deliverActionSelection(
    req,
    facts.then(() => action),
  );
  controller.abort(new Error("cancelled"));
  expect(await selection).toEqual(action);
  expect(await facts).toEqual({ kind: "committed", interrupted: true, events: [] });
  await channel.complete({ kind: "resolved", interrupted: false, events: [] });
  expect(await facts).toHaveProperty("interrupted", true);
});

test("误把需要反馈的串行机制改为并发时明确失败并收口，不占住限流槽等待超时", async () => {
  const provider = {
    getAction(req: ActionRequest) {
      const task = Promise.resolve().then(async () => {
        await awaitActionExecution(req, action);
        return action;
      });
      return deliverActionSelection(req, task);
    },
  };
  await expect(
    withActionExecutionScope(provider, [], async (scoped) => {
      await Promise.all([scoped.getAction(request()), scoped.getAction(request())]);
    }),
  ).rejects.toThrow("action_execution_requires_serial_requests");
});
