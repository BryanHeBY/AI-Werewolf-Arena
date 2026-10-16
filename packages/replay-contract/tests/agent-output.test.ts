/**
 * 负责统一输出归档适配的单元测试。输入为独立字面原文、工具候选和旧档字段，预期由完整 Unicode、明确通道与未生效回执给出。
 * 验证真实 player schema 2 的往返，不依赖 renderer、运行时或生产规则推导预期。
 */
import { expect, test } from "bun:test";
import {
  agentOutputToDeltaMessages,
  agentOutputFromDeltaMessages,
  readReplayPlayerView,
} from "../src";

test("长思考经过真实 player schema 2 编码后完整保留 Unicode，旧档不被伪装成思考", () => {
  const thought = "长".repeat(7999) + "😀" + "尾".repeat(9000);
  const delta = agentOutputToDeltaMessages([{ type: "text", channel: "thinking", text: thought }]);
  const archive = readReplayPlayerView(
    JSON.parse(
      JSON.stringify({
        schemaVersion: 2,
        player_id: 7,
        role: "witch",
        camp: "good",
        timeline: [
          {
            seq: 1,
            kind: "turn",
            day: 1,
            phase: "night",
            stage: "witch",
            request_id: "private-7",
            turn_seq: 1,
            delta_messages: delta,
          },
        ],
      }),
    ),
  );
  const turn = archive.timeline[0]!;
  if (turn.kind !== "turn") throw new Error("expected_turn");
  const outputs = agentOutputFromDeltaMessages(turn.delta_messages);
  expect(outputs.map((output) => (output.type === "text" ? output.text : "")).join("")).toBe(
    thought,
  );
  expect(
    delta.every((message) => message.content!.length <= 8000 && message.content!.isWellFormed()),
  ).toBe(true);
  expect(
    agentOutputFromDeltaMessages([
      { role: "assistant", kind: "assistant_output", content: "legacy" },
    ]),
  ).toEqual([{ type: "text", channel: "output", text: "legacy" }]);
});

test("工具接受只作为候选元数据往返，诊断不扩展字段或引入控制符", () => {
  const delta = agentOutputToDeltaMessages([
    {
      type: "tool",
      name: "submit_action",
      status: "started",
      args: { text: "原文" },
      accepted: true,
    },
    {
      type: "tool",
      name: "submit_action",
      status: "completed",
      result: { ok: true, applied: false },
    },
    { type: "error", diagnostic: { code: "rate_limited", statusCode: 429 } },
  ]);
  const outputs = agentOutputFromDeltaMessages(delta);
  expect(outputs[0]).toMatchObject({ type: "tool", accepted: true, args: { text: "原文" } });
  expect(outputs[1]).toMatchObject({ type: "tool", result: { ok: true, applied: false } });
  expect(outputs[2]).toEqual({
    type: "error",
    diagnostic: { code: "rate_limited", statusCode: 429 },
  });
  expect(JSON.stringify(delta)).not.toContain("\\u001b");
});
