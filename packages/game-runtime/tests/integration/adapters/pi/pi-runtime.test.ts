/**
 * 集成测试将正式 Pi 1.3 SDK 接到字面 localhost SSE 服务，不调用外部或计费模型。
 * 独立预期检查只开放宿主工具、真实思考与正文、接受后零额外请求、拒绝输入和取消前缀。
 */
import { describe, expect, test } from "bun:test";
import { PiRuntime, type PiSessionEvent } from "../../../../src/adapters/pi";

function response(deltas: Record<string, unknown>[], finish = "stop"): Response {
  const data: Array<Record<string, unknown>> = deltas.map((delta) => ({
    id: "chat-test",
    object: "chat.completion.chunk",
    created: 0,
    model: "awa-local",
    choices: [{ index: 0, delta, finish_reason: null }],
  }));
  data.push({
    id: "chat-test",
    object: "chat.completion.chunk",
    created: 0,
    model: "awa-local",
    choices: [{ index: 0, delta: {}, finish_reason: finish }],
  });
  return new Response(
    data.map((item) => `data: ${JSON.stringify(item)}\n\n`).join("") + "data: [DONE]\n\n",
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

function calls(...values: Array<{ id: string; name: string; args: unknown }>): Response {
  return response(
    values.map((value, index) => ({
      tool_calls: [
        {
          index,
          id: value.id,
          type: "function",
          function: { name: value.name, arguments: JSON.stringify(value.args) },
        },
      ],
    })),
    "tool_calls",
  );
}

const tool = {
  name: "submit_action",
  description: "提交游戏候选",
  parameters: {
    type: "object",
    properties: { turn_id: { type: "string" } },
    required: ["turn_id"],
    additionalProperties: false,
  },
};
const settings = {
  defaultProvider: "awa-local",
  defaultModel: "awa-local",
  retry: { enabled: false, provider: { maxRetries: 0 } },
};

async function fixture(
  handler: (request: Request, index: number) => Response | Promise<Response>,
  native?: { provider: string; apiKey: string; modelHeader: string },
) {
  const requests: Array<{
    body: Record<string, unknown>;
    auth: string | null;
    custom: string | null;
  }> = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      requests.push({
        body: (await request.clone().json()) as Record<string, unknown>,
        auth: request.headers.get("authorization"),
        custom: request.headers.get("x-model"),
      });
      return handler(request, requests.length);
    },
  });
  try {
    const runtime = await PiRuntime.create({
      models: {
        providers: {
          [native?.provider ?? "awa-local"]: {
            baseUrl: `${server.url.origin}/v1`,
            api: "openai-completions",
            ...(native ? { apiKey: native.apiKey } : {}),
            authHeader: true,
            headers: { "x-provider": "provider" },
            models: [
              {
                id: "awa-local",
                reasoning: true,
                headers: { "x-model": native?.modelHeader ?? "model" },
                compat: { supportsReasoningEffort: false },
              },
            ],
          },
        },
      },
      auth: native ? {} : { "awa-local": { type: "api_key", key: "local-test-key" } },
    });
    return { runtime, requests, server };
  } catch (error) {
    server.stop(true);
    throw error;
  }
}

describe("Pi 官方 SDK 的内存游戏传输", () => {
  test("缺失显式 header 环境引用只返回固定码，不回显变量名", async () => {
    const f = await fixture(() => response([{ content: "must-not-request" }]), {
      provider: "openai",
      apiKey: "synthetic",
      modelHeader: "$AWA_PI_MISSING_HEADER_CANARY_73dc4d",
    });
    try {
      const session = await f.runtime.createSession({
        settings: { ...settings, defaultProvider: "openai" },
        systemPrompt: "玩家",
        tools: [tool],
      });
      let observed: unknown;
      try {
        await session.prompt("行动", { onToolCall: async () => ({ toolResult: "unused" }) });
      } catch (error) {
        observed = error;
      }
      expect(observed).toBeInstanceOf(Error);
      expect((observed as Error).message).toContain("pi_header_env_missing");
      expect((observed as Error).message).not.toContain("AWA_PI_MISSING_HEADER_CANARY");
      expect(f.requests).toHaveLength(0);
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });
  test("原生 models 的内置 provider apiKey 与显式 $VAR header 在封闭认证后仍工作", async () => {
    const f = await fixture(() => response([{ content: "原生配置接通" }]), {
      provider: "openai",
      apiKey: "native-model-key",
      modelHeader: "$PATH",
    });
    try {
      const session = await f.runtime.createSession({
        settings: { ...settings, defaultProvider: "openai" },
        systemPrompt: "玩家",
        tools: [tool],
      });
      const result = await session.prompt("行动", {
        onToolCall: async () => ({ toolResult: "unused" }),
      });
      expect(result.assistantText).toBe("原生配置接通");
      expect(f.requests[0]!.auth).toBe("Bearer native-model-key");
      expect(f.requests[0]!.custom).toBe(process.env.PATH!);
      expect(f.requests).toHaveLength(1);
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });
  test("只发送宿主工具且接受后无额外模型请求，Pi 自持跨轮历史", async () => {
    const f = await fixture((_req, index) =>
      index === 1
        ? calls(
            { id: "ok", name: "submit_action", args: { turn_id: "t1" } },
            { id: "late", name: "submit_action", args: { turn_id: "t1" } },
          )
        : response([{ content: "第二轮已收到" }]),
    );
    try {
      const session = await f.runtime.createSession({
        settings,
        systemPrompt: "你是玩家",
        tools: [tool],
      });
      const invoked: string[] = [];
      const result = await session.prompt("轮到你了", {
        onToolCall: async (invocation) => {
          invoked.push(invocation.id);
          return { toolResult: { ok: true }, finalAction: "accepted" };
        },
      });
      expect(result.finalAction).toBe("accepted");
      expect(invoked).toEqual(["ok"]);
      expect(f.requests).toHaveLength(1);
      expect(
        (f.requests[0]!.body.tools as Array<{ function: { name: string } }>).map(
          (entry) => entry.function.name,
        ),
      ).toEqual(["submit_action"]);
      expect(f.requests[0]!.auth).toBe("Bearer local-test-key");
      expect(f.requests[0]!.custom).toBe("model");
      await session.prompt("下一轮", { onToolCall: async () => ({ toolResult: "unused" }) });
      expect(f.requests).toHaveLength(2);
      expect(JSON.stringify(f.requests[1]!.body.messages)).toContain("轮到你了");
      expect(JSON.stringify(f.requests[1]!.body.messages)).toContain("下一轮");
      await session.close();
      expect(f.runtime.runtimeState.sessions).toBe(0);
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });

  test("真实思考增量独立采集，完成事件不重复正文", async () => {
    const f = await fixture(() =>
      response([
        { reasoning_content: "先判断" },
        { reasoning_content: "再行动" },
        { content: "大家好" },
      ]),
    );
    try {
      const session = await f.runtime.createSession({
        settings,
        systemPrompt: "玩家",
        tools: [tool],
      });
      const events: PiSessionEvent[] = [];
      const result = await session.prompt("发言", {
        onEvent: (event) => events.push(event),
        onToolCall: async () => ({ toolResult: "unused" }),
      });
      expect(result.thinkingText).toBe("先判断再行动");
      expect(result.assistantText).toBe("大家好");
      expect(
        events
          .filter((event) => event.type === "thinking")
          .map((event) => ("text" in event ? event.text : ""))
          .join(""),
      ).toBe("先判断再行动");
      expect(events.at(-1)).toEqual({ type: "settled", aborted: false });
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });

  test("显示异常不阻止工具登记与接受，结束后保原错和前缀", async () => {
    const f = await fixture(() =>
      calls({ id: "ok", name: "submit_action", args: { turn_id: "t1" } }),
    );
    const displayError = new Error("display-only");
    try {
      const session = await f.runtime.createSession({
        settings,
        systemPrompt: "玩家",
        tools: [tool],
      });
      let invoked = 0;
      await expect(
        session.prompt("行动", {
          onEvent: () => {
            throw displayError;
          },
          onToolCall: async () => {
            invoked++;
            return { toolResult: "ok", finalAction: 7 };
          },
        }),
      ).rejects.toBe(displayError);
      expect(invoked).toBe(1);
      expect(session.takeTrace<number>().finalAction).toBe(7);
      expect(session.takeTrace().toolCalls).toHaveLength(1);
      expect(f.requests).toHaveLength(1);
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });

  test("SDK schema 连续拒绝也回到宿主计数，第三次拒绝后不再请求", async () => {
    const f = await fixture((_req, index) =>
      calls({ id: `bad-${index}`, name: "submit_action", args: { wrong: true } }),
    );
    const rejected = new Error("third_rejection");
    try {
      const session = await f.runtime.createSession({
        settings,
        systemPrompt: "玩家",
        tools: [tool],
      });
      const invalid: Array<{ id: string; args: unknown }> = [];
      let invoked = 0;
      await expect(
        session.prompt("行动", {
          onInvalidToolCall: (invocation) => {
            invalid.push({ id: invocation.id, args: invocation.args });
            if (invalid.length === 3) throw rejected;
          },
          onToolCall: async () => {
            invoked++;
            return { toolResult: "bad" };
          },
        }),
      ).rejects.toBe(rejected);
      expect(invalid).toEqual([
        { id: "bad-1", args: { wrong: true } },
        { id: "bad-2", args: { wrong: true } },
        { id: "bad-3", args: { wrong: true } },
      ]);
      expect(invoked).toBe(0);
      expect(f.requests).toHaveLength(3);
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });

  test("未知工具先拒绝而不取得宿主执行权", async () => {
    const f = await fixture(() => calls({ id: "shell", name: "bash", args: { command: "never" } }));
    try {
      const session = await f.runtime.createSession({
        settings,
        systemPrompt: "玩家",
        tools: [tool],
      });
      const invalid: string[] = [];
      const result = await session.prompt("行动", {
        maxSteps: 1,
        onInvalidToolCall: (invocation) => {
          invalid.push(invocation.name);
        },
        onToolCall: async () => {
          throw new Error("must-not-run");
        },
      });
      expect(invalid).toEqual(["bash"]);
      expect(result.finalAction).toBeNull();
      expect(f.requests).toHaveLength(1);
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });

  test("真实模型 HTTP 错误保留原因，不能当作正常无候选", async () => {
    const f = await fixture(() =>
      Response.json({ error: { message: "local-model-broken" } }, { status: 400 }),
    );
    try {
      const session = await f.runtime.createSession({
        settings,
        systemPrompt: "玩家",
        tools: [tool],
      });
      await expect(
        session.prompt("行动", { onToolCall: async () => ({ toolResult: "bad" }) }),
      ).rejects.toThrow("local-model-broken");
      expect(f.requests).toHaveLength(1);
      expect(session.runtimeState.pending).toBe(0);
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });

  test("工具回调抛错保原对象且没有模型续问", async () => {
    const f = await fixture(() =>
      calls({ id: "ok", name: "submit_action", args: { turn_id: "t1" } }),
    );
    const cause = new Error("host-handler-failed");
    try {
      const session = await f.runtime.createSession({
        settings,
        systemPrompt: "玩家",
        tools: [tool],
      });
      await expect(
        session.prompt("行动", {
          onToolCall: async () => {
            throw cause;
          },
        }),
      ).rejects.toBe(cause);
      expect(f.requests).toHaveLength(1);
      expect(
        session.takeTrace().events.some((event) => event.type === "tool_end" && event.isError),
      ).toBe(true);
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });

  test("显式无效 stop 在第三次拒绝后正常收尾", async () => {
    const f = await fixture((_req, index) =>
      calls({ id: `bad-${index}`, name: "submit_action", args: {} }),
    );
    try {
      const session = await f.runtime.createSession({
        settings,
        systemPrompt: "玩家",
        tools: [tool],
      });
      let rejected = 0;
      const result = await session.prompt("行动", {
        onInvalidToolCall: () => ({ stop: ++rejected === 3 }),
        onToolCall: async () => {
          throw new Error("must-not-run");
        },
      });
      expect(rejected).toBe(3);
      expect(result.finalAction).toBeNull();
      expect(f.requests).toHaveLength(3);
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });

  test("事件同步重入不能开启第二轮或覆盖第一轮 trace", async () => {
    const f = await fixture(() => response([{ content: "当前轮" }]));
    try {
      const session = await f.runtime.createSession({
        settings,
        systemPrompt: "玩家",
        tools: [tool],
      });
      const reentrant: Promise<unknown>[] = [];
      const result = await session.prompt("当前轮", {
        onEvent: (event) => {
          if (event.type === "message" && event.partial)
            reentrant.push(
              session
                .prompt("重入", { onToolCall: async () => ({ toolResult: "unused" }) })
                .catch((error) => error),
            );
        },
        onToolCall: async () => ({ toolResult: "unused" }),
      });
      expect(result.assistantText).toBe("当前轮");
      expect(
        (await Promise.all(reentrant)).every(
          (error) => error instanceof Error && error.message === "pi_session_busy",
        ),
      ).toBe(true);
      expect(f.requests).toHaveLength(1);
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });

  test("取消立即撤回借用且等在途工具结算，保原取消对象", async () => {
    const f = await fixture(() =>
      calls({ id: "ok", name: "submit_action", args: { turn_id: "t1" } }),
    );
    const controller = new AbortController();
    const reason = new Error("outer-deadline");
    let entered!: () => void;
    const entry = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      const session = await f.runtime.createSession({
        settings,
        systemPrompt: "玩家",
        tools: [tool],
      });
      const pending = session.prompt("行动", {
        signal: controller.signal,
        onToolCall: async () => {
          entered();
          await gate;
          return { toolResult: "late", finalAction: 7 };
        },
      });
      const observed = pending.catch((error) => error);
      await entry;
      controller.abort(reason);
      expect(session.runtimeState.pending).toBe(1);
      expect(session.takeTrace().finalAction).toBeNull();
      release();
      expect(await observed).toBe(reason);
      expect(session.runtimeState.pending).toBe(0);
      expect(session.takeTrace().finalAction).toBeNull();
      expect(f.requests).toHaveLength(1);
    } finally {
      release();
      await f.runtime.close();
      f.server.stop(true);
    }
  });

  test("Pi 的真实自动重试事件与恢复后思考都被采集", async () => {
    const f = await fixture((_req, index) =>
      index === 1
        ? Response.json({ error: { message: "overloaded" } }, { status: 503 })
        : response([{ reasoning_content: "恢复后思考" }, { content: "已恢复" }]),
    );
    try {
      const session = await f.runtime.createSession({
        settings: {
          ...settings,
          retry: { enabled: true, maxRetries: 1, baseDelayMs: 1, provider: { maxRetries: 0 } },
        },
        systemPrompt: "玩家",
        tools: [tool],
      });
      const result = await session.prompt("行动", {
        onToolCall: async () => ({ toolResult: "unused" }),
      });
      expect(result.thinkingText).toBe("恢复后思考");
      expect(result.assistantText).toBe("已恢复");
      expect(
        result.events.some((event) => event.type === "retry_start" && event.attempt === 1),
      ).toBe(true);
      expect(result.events.some((event) => event.type === "retry_end" && event.success)).toBe(true);
      expect(f.requests).toHaveLength(2);
    } finally {
      await f.runtime.close();
      f.server.stop(true);
    }
  });
});
