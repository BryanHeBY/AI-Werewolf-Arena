/**
 * 通过真实 SDK 编排核对派发边界：重试记录与传输收到的完整消息一致，过期请求不伪造输入。
 * 使用内存客户端与轮次记录探针，不调用模型或修改领域状态。
 */
import { expect, spyOn, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { PlayerRoundRecorder } from "../../../../src/app/player-round-recorder";
import { LlmActionProvider } from "../../../../src/agents/llm/llm-action-provider";
import type { ChatMessage, ChatModelClient } from "../../../../src/adapters/llm/transport";
import { speakRequest } from "../../../support/builders/agents/acp-requests";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";

test("SDK retries record each full request actually handed to the client", async () => {
  const sent: ChatMessage[][] = [];
  const recorded = spyOn(PlayerRoundRecorder.prototype, "record").mockImplementation(() => {});
  const client: ChatModelClient = {
    async chat() {
      return "";
    },
    async runToolLoop<T>(messages, _tools, callbacks) {
      sent.push(structuredClone(messages));
      if (sent.length === 1) return { finalAction: null, assistantText: "" };
      const turn = messages
        .map((message) => message.content)
        .join("\n")
        .match(/turn_id must be (t\d+)/)![1]!;
      const result = await callbacks.onToolCall({
        id: "recorded-submit",
        name: "submit_action",
        rawArgs: "{}",
        args: { turn_id: turn, action: "speak", arguments: { text: "继续" } },
      });
      return { finalAction: result.finalAction ?? null, assistantText: "" };
    },
  };
  const provider = new LlmActionProvider(
    bootstrapGame(sixPlayerMvpConfig, { locale: "en" }).world,
    client,
    { llmTimeoutMs: 1000 },
  );
  try {
    expect(await provider.getAction(speakRequest())).toEqual({
      name: "speak",
      args: { text: "继续" },
    });
    expect(sent).toHaveLength(2);
    expect(sent[1]!.length).toBeGreaterThan(sent[0]!.length);
    expect(recorded.mock.calls[0]![2].inputs).toEqual(
      sent.map((messages) => ({ mode: "full_messages", messages })),
    );
  } finally {
    await provider.close();
    recorded.mockRestore();
  }
});

test("SDK expired before dispatch retains diagnostic prompt with no recorded model input", async () => {
  const recorded = spyOn(PlayerRoundRecorder.prototype, "record").mockImplementation(() => {});
  let calls = 0;
  const client: ChatModelClient = {
    async chat() {
      return "";
    },
    async runToolLoop<T>() {
      calls++;
      return { finalAction: null, assistantText: "" };
    },
  };
  const provider = new LlmActionProvider(bootstrapGame(sixPlayerMvpConfig).world, client);
  try {
    const request = speakRequest();
    request.deadlineAtMs = Date.now() - 1;
    expect(await provider.getAction(request)).toBeNull();
    expect(calls).toBe(0);
    expect(recorded.mock.calls[0]![1].userPrompt.length).toBeGreaterThan(0);
    expect(recorded.mock.calls[0]![2].inputs).toEqual([]);
  } finally {
    await provider.close();
    recorded.mockRestore();
  }
});
