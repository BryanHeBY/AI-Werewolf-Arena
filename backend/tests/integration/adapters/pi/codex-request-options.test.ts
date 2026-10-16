/**
 * 本集成测试负责核对正式 Pi Codex 传输的请求配置；输入为合成 OAuth、原生模型覆盖和本机 HTTP。
 * 模拟旧订阅端点拒绝 fast、接受 priority，核对 medium、账户头和请求路径，并消费真实 SDK 响应。
 * 预期由字面服务档位、账户头与完整合成响应给出；关闭始终回收内存会话与监听器；不接触真实订阅或模型，不推断账户权限和限额。
 */
import { expect, test } from "bun:test";
import { PiRuntime } from "../../../../src/adapters/pi";

const account = "synthetic-codex-account";
const access = [
  Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
  Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      "https://api.openai.com/auth": { chatgpt_account_id: account },
    }),
  ).toString("base64url"),
  "synthetic-signature",
].join(".");

for (const [model, fast] of [
  ["gpt-6-luna", true],
  ["gpt-6.1-sol", true],
  ["gpt-6-luna", false],
] as const)
  test(`Pi Codex ${model}/fast=${fast} sends native model settings with subscription auth`, async () => {
    const requests: Array<{
      body: Record<string, unknown>;
      auth: string | null;
      account: string | null;
      path: string;
    }> = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        // 正式 Codex SSE 客户端可能压缩请求；按线上的 Content-Encoding 解码后核对原正文。
        const bytes = await request.arrayBuffer();
        const body =
          request.headers.get("content-encoding") === "zstd"
            ? Bun.zstdDecompressSync(bytes).toString("utf8")
            : new TextDecoder().decode(bytes);
        const payload = JSON.parse(body) as Record<string, unknown>;
        requests.push({
          body: payload,
          auth: request.headers.get("authorization"),
          account: request.headers.get("chatgpt-account-id"),
          path: new URL(request.url).pathname,
        });
        // 复现真实订阅错误，避免仅验证发出的字段却遗漏端点兼容性。
        const message = {
          id: "msg_synthetic",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "OK", annotations: [] }],
        };
        const events =
          payload.service_tier === "fast"
            ? [{ type: "error", message: "Unsupported service_tier: fast" }]
            : [
                { type: "response.created", response: { id: "resp_synthetic" } },
                {
                  type: "response.output_item.added",
                  output_index: 0,
                  item: { ...message, status: "in_progress", content: [] },
                },
                { type: "response.output_text.delta", output_index: 0, delta: "OK" },
                { type: "response.output_item.done", output_index: 0, item: message },
                {
                  type: "response.completed",
                  response: { id: "resp_synthetic", status: "completed", output: [message] },
                },
              ];
        return new Response(
          events
            .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
            .join(""),
          { headers: { "content-type": "text/event-stream" } },
        );
      },
    });
    let runtime: PiRuntime | undefined;
    try {
      runtime = await PiRuntime.create({
        models: {
          providers: {
            "openai-codex": {
              baseUrl: server.url.origin,
              ...(fast
                ? { modelOverrides: { [model]: { samplingParams: { service_tier: "fast" } } } }
                : {}),
            },
          },
        },
        auth: {
          "openai-codex": {
            type: "oauth",
            access,
            refresh: "synthetic-not-used",
            expires: Date.now() + 3600000,
            accountId: account,
          },
        },
      });
      const session = await runtime.createSession({
        settings: {
          defaultProvider: "openai-codex",
          defaultModel: model,
          defaultThinkingLevel: "medium",
          transport: "sse",
          retry: { enabled: false, provider: { maxRetries: 0 } },
        },
        systemPrompt: "合成配置验证",
        tools: [],
      });
      const result = await session.prompt("检查请求形状", {
        onToolCall: async () => {
          throw new Error("unexpected_tool");
        },
      });
      expect(result.assistantText).toBe("OK");
      expect(requests).toHaveLength(1);
      expect(requests[0]!.body.model).toBe(model);
      expect(requests[0]!.body.reasoning).toMatchObject({ effort: "medium" });
      expect(requests[0]!.body.service_tier).toBe(fast ? "priority" : undefined);
      expect(requests[0]!.auth).toBe(`Bearer ${access}`);
      expect(requests[0]!.account).toBe(account);
      expect(requests[0]!.path).toBe("/codex/responses");
    } finally {
      await runtime?.close();
      server.stop(true);
    }
  });
