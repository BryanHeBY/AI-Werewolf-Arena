/**
 * 单元测试负责核对终端／Web 共用反馈展示与历史回执兼容。输入为独立字面回执及旧玩家录制，
 * 输出以自然语言、显示开关及精确往返为预期；不执行规则，不从真实底牌构造报告。
 */
import { expect, test } from "bun:test";
import {
  agentActionExecution,
  agentOutputFromDeltaMessages,
  agentOutputToDeltaMessages,
  type AgentOutput,
} from "@ai-werewolf-arena/replay-contract";
import { agentOutputPresentation, isAgentOutputVisible } from "../src";

const result = {
  ok: true,
  accepted: true,
  applied: true,
  action: "check_identity",
  status: "resolved",
  feedback: {
    version: 1,
    events: [
      {
        type: "seer_checked",
        payload: {
          actorId: 3,
          targetId: 6,
          isWerewolf: false,
          result: { kind: "camp", camp: "good" },
        },
      },
    ],
  },
};
const output: AgentOutput = { type: "tool", name: "submit_action", status: "completed", result };

test("查验自然语言与原始回执同源，MCP 包装和 player schema 2 回读一致", () => {
  const restored = agentOutputFromDeltaMessages(
    JSON.parse(JSON.stringify(agentOutputToDeltaMessages([output]))),
  )[0]!;
  expect(agentActionExecution(restored)?.feedback.events[0]?.payload.result).toEqual({
    kind: "camp",
    camp: "good",
  });
  const zh = agentOutputPresentation(restored, "zh-CN"),
    en = agentOutputPresentation(restored, "en");
  expect(zh.label).toBe("结果已揭晓");
  expect(zh.body).toContain("6");
  expect(zh.body).toContain("好人");
  expect(en.body).toContain("Good");
  expect(zh.body).not.toContain('"payload"');
  const wrapped: AgentOutput = {
    ...output,
    result: { content: [{ type: "text", text: JSON.stringify(result) }] },
  };
  expect(agentActionExecution(wrapped)).toEqual(agentActionExecution(output));
  expect(
    isAgentOutputVisible(output, { printThinking: false, printLlmIo: false, trace: false }),
  ).toBe(false);
  expect(
    isAgentOutputVisible(output, { printThinking: true, printLlmIo: false, trace: false }),
  ).toBe(true);
});

test("用药只显示登记与后续结算，不声称救活；未知和中断均不声称退款", () => {
  const potion: AgentOutput = {
    type: "tool",
    name: "werewolf-game.submit_action",
    status: "completed",
    result: {
      ...result,
      action: "use_potion",
      status: "committed",
      feedback: {
        version: 1,
        events: [
          { type: "witch_potion_used", payload: { actorId: 5, targetId: 6, potionType: "heal" } },
        ],
      },
    },
  };
  expect(agentOutputPresentation(potion).body).toContain("最终效果在后续阶段结算");
  for (const status of ["unavailable", "interrupted"] as const) {
    const unknown: AgentOutput = {
      ...output,
      result: { ...result, status, applied: null, feedback: { version: 1, events: [] } },
    };
    expect(agentOutputPresentation(unknown).tone).toBe("warn");
    expect(agentActionExecution(unknown)?.applied).toBeNull();
  }
});

test("旧选择回执、确认回执和未知新版本按原含义展示，不从模型正文解释 JSON", () => {
  const old: AgentOutput = {
    ...output,
    result: { ok: true, accepted: true, applied: false, action: "check_identity" },
  };
  expect(agentActionExecution(old)).toBeUndefined();
  expect(agentOutputPresentation(old).label).toBe("工具结果");
  const confirmation: AgentOutput = {
    ...output,
    result: {
      ok: true,
      accepted: true,
      applied: false,
      action: "self_destruct",
      status: "confirmed",
      confirmation_id: "same-turn",
    },
  };
  expect(agentOutputPresentation(confirmation).label).toBe("已二次确认（尚未生效）");
  expect(
    agentActionExecution({ type: "text", channel: "message", text: JSON.stringify(result) }),
  ).toBeUndefined();
  expect(
    agentActionExecution({
      ...output,
      result: { ...result, feedback: { version: 2, events: [] } },
    }),
  ).toBeUndefined();
  expect(
    agentActionExecution({ ...output, result: { ...result, applied: false } }),
  ).toBeUndefined();
});
