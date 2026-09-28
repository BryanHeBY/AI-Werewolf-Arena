import { describe, expect, test } from "bun:test";
import { AiSdkClient } from "../../../src/ai/integrations/llm/ai_sdk_client";

describe("AiSdkClient with the installed AI SDK", () => {
  test("sends chat messages through an OpenAI-compatible provider", async () => {
    const requests: Record<string, unknown>[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        requests.push(await request.json() as Record<string, unknown>);
        return completion({ role: "assistant", content: "收到" }, "stop");
      },
    });

    try {
      const client = new AiSdkClient({
        apiKey: "test-key",
        baseURL: `${server.url.origin}/v1`,
        model: "test-model",
        reasoningEnabled: true,
        reasoningEffort: "high",
      });
      const result = await client.chatWithMeta([
        { role: "system", content: "你是玩家" },
        { role: "user", content: "轮到你了" },
      ]);

      expect(result).toEqual({ content: "收到", finishReason: "stop" });
      expect(requests).toHaveLength(1);
      expect(requests[0]?.messages).toEqual([
        { role: "system", content: "你是玩家" },
        { role: "user", content: "轮到你了" },
      ]);
      expect(requests[0]?.reasoning).toEqual({ effort: "high" });
    } finally {
      server.stop(true);
    }
  });

  test("executes a model tool call and stops after the domain accepts it", async () => {
    const requests: Record<string, unknown>[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        requests.push(await request.json() as Record<string, unknown>);
        return completion({
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "call-1",
            type: "function",
            function: { name: "submit_action", arguments: '{"target_id":2}' },
          }],
        }, "tool_calls");
      },
    });

    try {
      const client = new AiSdkClient({
        apiKey: "test-key",
        baseURL: `${server.url.origin}/v1`,
        model: "test-model",
        reasoningEnabled: false,
      });
      const result = await client.runToolLoop(
        [{ role: "user", content: "投票" }],
        [{
          name: "submit_action",
          description: "提交投票",
          parameters: {
            type: "object",
            properties: { target_id: { type: "integer" } },
            required: ["target_id"],
          },
        }],
        {
          async onToolCall(invocation) {
            expect(invocation).toMatchObject({
              id: "call-1",
              name: "submit_action",
              args: { target_id: 2 },
            });
            return { toolResult: { accepted: true }, finalAction: { targetId: 2 }, stop: true };
          },
        },
      );

      expect(result.finalAction).toEqual({ targetId: 2 });
      expect(result.thinkingTrace[0]?.toolCalls).toMatchObject([
        { id: "call-1", name: "submit_action", stop: true, hasFinalAction: true },
      ]);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.tools).toMatchObject([
        { type: "function", function: { name: "submit_action" } },
      ]);
    } finally {
      server.stop(true);
    }
  });
});

function completion(message: Record<string, unknown>, finishReason: string): Response {
  return Response.json({
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 1,
    model: "test-model",
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}
