/**
 * 集成测试将已安装 AI SDK 接到测试持有的 localhost HTTP 服务，以字面请求／响应及工具回调预期核对 provider 选项、接受行动和安全失败分类。预期来自既有字面值及独立夹具；仅本地传输／录制，不接触外部或计费模型。
 */
import { describe, expect, test } from "bun:test";
import { AiSdkClient } from "../../../../src/adapters/llm/ai-sdk-client";

describe("AiSdkClient with the installed AI SDK", () => {
  test("sends chat messages through an OpenAI-compatible provider", async () => {
    const requests: Record<string, unknown>[] = [];
    const userAgents: string[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        userAgents.push(request.headers.get("user-agent") ?? "");
        requests.push((await request.json()) as Record<string, unknown>);
        return completion({ role: "assistant", content: "收到" }, "stop");
      },
    });

    try {
      const client = new AiSdkClient({
        apiKey: "test-key",
        providerName: "open-router",
        baseURL: `${server.url.origin}/v1`,
        model: "test-model",
        userAgent: "AWA-Config-Test",
        reasoningEffort: "high",
        thinkingEnabled: true,
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
      expect(requests[0]?.reasoning_effort).toBe("high");
      expect(requests[0]?.extra_body).toEqual({ thinking: { type: "enabled" } });
      expect(userAgents[0]).toContain("AWA-Config-Test");
    } finally {
      server.stop(true);
    }
  });

  test("uses native Anthropic thinking options when requested", async () => {
    const requests: Record<string, unknown>[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        requests.push((await request.json()) as Record<string, unknown>);
        return Response.json({
          id: "msg-test",
          type: "message",
          role: "assistant",
          model: "claude-test",
          content: [{ type: "text", text: "收到" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      },
    });

    try {
      const client = new AiSdkClient({
        providerType: "anthropic",
        providerName: "custom_claude",
        apiKey: "test-key",
        baseURL: `${server.url.origin}/v1`,
        model: "claude-test",
        thinkingEnabled: true,
        reasoningEffort: "high",
      });
      expect(await client.chat([{ role: "user", content: "轮到你了" }])).toBe("收到");
      expect(requests[0]?.thinking).toEqual({ type: "adaptive" });
      expect(requests[0]?.output_config).toMatchObject({ effort: "high" });
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
        requests.push((await request.json()) as Record<string, unknown>);
        return completion(
          {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call-1",
                type: "function",
                function: { name: "submit_action", arguments: '{"target_id":2}' },
              },
            ],
          },
          "tool_calls",
        );
      },
    });

    try {
      const client = new AiSdkClient({
        apiKey: "test-key",
        baseURL: `${server.url.origin}/v1`,
        model: "test-model",
      });
      const result = await client.runToolLoop(
        [{ role: "user", content: "投票" }],
        [
          {
            name: "submit_action",
            description: "提交投票",
            parameters: {
              type: "object",
              properties: { target_id: { type: "integer" } },
              required: ["target_id"],
            },
          },
        ],
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
      expect(requests[0]).not.toHaveProperty("reasoning_effort");
      expect(requests[0]?.tools).toMatchObject([
        { type: "function", function: { name: "submit_action" } },
      ]);
    } finally {
      server.stop(true);
    }
  });

  test("does not retry a rejected request that the SDK marks non-retryable", async () => {
    let requests = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch() {
        requests += 1;
        return Response.json({ error: { message: "invalid model" } }, { status: 400 });
      },
    });

    try {
      const client = new AiSdkClient({
        apiKey: "test-key",
        baseURL: `${server.url.origin}/v1`,
        model: "invalid-model",
      });
      await expect(client.chat([{ role: "user", content: "测试" }])).rejects.toThrow(
        "invalid model",
      );
      expect(requests).toBe(1);
    } finally {
      server.stop(true);
    }
  });

  test("returns a required-tool non-action to the game retry policy", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch() {
        return completion({ role: "assistant", content: "我还没有提交行动" }, "stop");
      },
    });
    try {
      const client = new AiSdkClient({
        apiKey: "test-key",
        baseURL: `${server.url.origin}/v1`,
        model: "test-model",
      });
      const result = await client.runToolLoop(
        [{ role: "user", content: "请提交行动" }],
        [
          {
            name: "submit_action",
            description: "提交行动",
            parameters: { type: "object", properties: {} },
          },
        ],
        {
          onToolCall: async () => {
            throw new Error("No tool should execute");
          },
        },
        { toolChoice: "required" },
      );
      expect(result.finalAction).toBeNull();
      expect(result.assistantText).toBe("我还没有提交行动");
      expect(result.thinkingTrace.at(-1)?.assistantText).toBe("我还没有提交行动");
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

test("historical tool messages use a neutral machine tag without changing original contents", async () => {
  const requests: Record<string, unknown>[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(input) {
      requests.push((await input.json()) as Record<string, unknown>);
      return Response.json({
        id: "history",
        object: "chat.completion",
        created: 1,
        model: "test",
        choices: [
          { index: 0, finish_reason: "stop", message: { role: "assistant", content: "ok" } },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    },
  });
  try {
    const client = new AiSdkClient({
      apiKey: "synthetic",
      baseURL: `${server.url.origin}/v1`,
      model: "test",
    });
    for (const content of ['{"ok":true}', "Original 中文"]) {
      expect(await client.chat([{ role: "tool", content }])).toBe("ok");
      expect(requests.at(-1)?.messages).toEqual([
        { role: "user", content: `[tool_result] ${content}` },
      ]);
    }
    expect(JSON.stringify(requests[0])).not.toMatch(/[\u4e00-\u9fff]/);
  } finally {
    server.stop(true);
  }
});
