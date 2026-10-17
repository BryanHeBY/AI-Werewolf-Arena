/**
 * 单元测试负责 Pi 单轮通知与轨迹的无重复编码。输入手写原生事件、宿主回执和失败显示端；
 * 预期来自字面文本、工具次数及实际错误对象，不运行模型、领域规则或持久化。
 */
import { expect, test } from "bun:test";
import { PiRoundRecording } from "../../../../src/agents/pi/pi-round-recording";
import type { PiPromptResult, PiSessionEvent } from "../../../../src/adapters/pi/contracts";
import type { AgentOutput } from "@ai-werewolf-arena/replay-contract";

const result = (events: PiSessionEvent[]): PiPromptResult<never> => ({
  finalAction: null,
  assistantText: "",
  thinkingText: "原始思考",
  toolCalls: [],
  events,
});

test("实时文本与工具输出只归一一次，漏通知的尾段仍从本轮轨迹补齐", () => {
  const live: AgentOutput[] = [];
  const recording = new PiRoundRecording({ transport: "pi" }, ({ output }) => live.push(output));
  const events: PiSessionEvent[] = [
    { type: "thinking", partial: true, blockId: "b1", text: "原始思考" },
    { type: "thinking", partial: false, blockId: "b1", text: "" },
    { type: "tool_start", id: "t1", name: "submit_action", args: { action: "speak" } },
    { type: "tool_end", id: "t1", name: "submit_action", result: { ok: true }, isError: false },
    { type: "message", partial: true, blockId: "b2", text: "漏通知尾部" },
  ];
  recording.begin("输入");
  for (const event of events.slice(0, 4)) recording.update(event);
  recording.finish(result(events));
  recording.flush();
  const messages = recording.messages([
    {
      id: "t1",
      name: "submit_action",
      args: { action: "speak" },
      accepted: true,
      result: { accepted: true },
    },
  ]);
  expect(
    messages.filter((message) => message.name === "thinking").map((message) => message.content),
  ).toEqual(["原始思考"]);
  expect(messages.filter((message) => message.kind === "tool_call")).toHaveLength(1);
  expect(messages.filter((message) => message.kind === "tool_result")).toHaveLength(1);
  expect(
    messages.filter((message) => message.name === "message").map((message) => message.content),
  ).toEqual(["漏通知尾部"]);
  expect(live.filter((output) => output.type === "tool")).toHaveLength(2);
});

test("工具事件触发文本刷新时显示失败，已归一工具事实仍留在同轮记录", () => {
  const failure = new Error("display_failed");
  const recording = new PiRoundRecording({ transport: "pi" }, () => {
    throw failure;
  });
  const text: PiSessionEvent = { type: "thinking", partial: true, blockId: "b1", text: "先保留" };
  const tool: PiSessionEvent = { type: "tool_start", id: "t1", name: "submit_action", args: {} };
  recording.begin("输入");
  recording.update(text);
  expect(() => recording.update(tool)).toThrow(AggregateError);
  recording.finish(result([text, tool]));
  recording.flush();
  const messages = recording.messages([]);
  expect(
    messages.filter((message) => message.name === "thinking").map((message) => message.content),
  ).toEqual(["先保留"]);
  expect(messages.filter((message) => message.kind === "tool_call")).toHaveLength(1);
});
