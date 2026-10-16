/**
 * 本集成测试负责经正式工厂和 Pi SDK 将审计接到本机 HTTP/SSE，手写工具结果验证先取上下文再正式提交。
 * 输入仅为合成凭据和独立任务，预期核对任务间历史隔离、纯文本不算提交及期限／close 后零有效结果。
 * 取消由真实 HTTP 流关闭见证；不复用玩家会话、不读取认证文件、不改旧 oracle 或请求外部模型。
 */
import { expect, test } from "bun:test";
import { access } from "node:fs/promises";
import path from "node:path";
import { createAuditAgentExecutor } from "../../../../src/app/audit-agent-factory";
import { PiAuditAgentExecutor } from "../../../../src/audit/agents/pi-audit-runner";
import type { ResolvedAgentRuntimeProfile } from "../../../../src/app/config/contracts";
import type { AuditToolContext } from "../../../../src/audit/agents/audit-tool-protocol";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

interface Message {
  role: string;
  content?: string | Array<{ text?: string }>;
  tool_call_id?: string;
}
interface Body {
  messages: Message[];
  tools: Array<{ function: { name: string } }>;
}
function content(message: Message): string {
  return typeof message.content === "string"
    ? message.content
    : (message.content ?? []).map((part) => part.text ?? "").join("\n");
}
function sse(deltas: Record<string, unknown>[], finish = "tool_calls"): Response {
  const chunks = [...deltas, {}].map((delta, index) => ({
    id: "audit-local",
    object: "chat.completion.chunk",
    created: 0,
    model: "audit-local",
    choices: [{ index: 0, delta, finish_reason: index === deltas.length ? finish : null }],
  }));
  return new Response(
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n",
    { headers: { "content-type": "text/event-stream" } },
  );
}
function tool(name: string, args: Record<string, unknown>, id = "formal"): Record<string, unknown> {
  return {
    tool_calls: [
      { index: 0, id, type: "function", function: { name, arguments: JSON.stringify(args) } },
    ],
  };
}

async function fixture(
  handler: (request: Request, body: Body, ordinal: number) => Response | Promise<Response>,
) {
  let requests = 0;
  const failures: string[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const ordinal = ++requests;
      try {
        expect(request.headers.get("authorization")).toBe("Bearer synthetic-audit-only");
        const body = (await request.json()) as Body;
        expect(body.tools.map((entry) => entry.function.name).sort()).toEqual([
          "get_audit_context",
          "get_audit_schema",
          "submit_audit_findings",
          "submit_audit_summary",
        ]);
        return await handler(request, body, ordinal);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : "audit_fixture_failed");
        return Response.json(
          { error: { message: "audit_fixture_protocol_failed" } },
          { status: 400 },
        );
      }
    },
  });
  const root = await createTestTempDirectory("awa-pi-audit-http-"),
    workspace = path.join(root, "unused-audit-workspace");
  const profile: ResolvedAgentRuntimeProfile = {
    kind: "pi",
    name: "synthetic-pi-audit",
    providerName: "audit-local",
    provider: {
      type: "pi",
      models: {
        providers: {
          "awa-audit": {
            baseUrl: `${server.url.origin}/v1`,
            api: "openai-completions",
            authHeader: true,
            models: [{ id: "audit-local" }],
          },
        },
      },
      auth: { "awa-audit": { type: "api_key", key: "synthetic-audit-only" } },
    },
    piSettings: {
      defaultProvider: "awa-audit",
      defaultModel: "audit-local",
      compaction: { enabled: false },
      retry: { enabled: false, provider: { maxRetries: 0 } },
    },
  };
  const executor = createAuditAgentExecutor({ profile, workspaceRoot: workspace });
  if (!(executor instanceof PiAuditAgentExecutor)) {
    server.stop(true);
    throw new Error("pi_audit_factory_did_not_select_native_executor");
  }
  return {
    executor,
    server,
    failures,
    workspace,
    get requests() {
      return requests;
    },
  };
}

for (const locale of ["zh-CN", "en"] as const)
  test(`Pi audit ${locale}: real get-context then submit, independent tasks and no player tools`, async () => {
    const contexts: AuditToolContext[] = [
      {
        locale,
        mode: "inspect",
        taskName: "task-A",
        source: "source-A",
        payload: { marker: "PRIVATE_TASK_A", events: [{ seq: 7 }] },
      },
      {
        locale,
        mode: "inspect",
        taskName: "task-B",
        source: "source-B",
        payload: { marker: "PRIVATE_TASK_B", events: [{ seq: 9 }] },
      },
      {
        locale,
        mode: "summarize",
        taskName: "task-C",
        source: "source-C",
        payload: { marker: "PRIVATE_TASK_C", findings: [] },
      },
    ];
    const f = await fixture((_request, body, ordinal) => {
      const task = contexts[Math.floor((ordinal - 1) / 2)];
      if (!task) throw new Error("pi_audit_extra_model_request");
      const user = body.messages.find((message) => message.role === "user");
      if (!user) throw new Error("pi_audit_prompt_missing");
      expect(content(user)).toContain("a1");
      const whole = JSON.stringify(body.messages);
      if (locale === "en") expect(whole).not.toMatch(/\p{Script=Han}/u);
      for (const other of contexts.filter((context) => context !== task))
        expect(whole).not.toContain(other.payload.marker as string);
      if (ordinal % 2 === 1) {
        expect(body.messages).toHaveLength(2);
        expect(whole).not.toContain(task.payload.marker as string);
        return sse([tool("get_audit_context", { turn_id: "a1" }, "context")]);
      }
      const result = body.messages.find(
        (message) => message.role === "tool" && message.tool_call_id === "context",
      );
      if (!result) throw new Error("pi_audit_context_result_missing");
      expect(JSON.parse(content(result))).toEqual({
        ok: true,
        context: {
          mode: task.mode,
          task_name: task.taskName,
          source: task.source,
          payload: task.payload,
        },
      });
      return task.mode === "inspect"
        ? sse([
            tool("submit_audit_findings", {
              turn_id: "a1",
              findings: [
                {
                  severity: "low",
                  category: "logging",
                  message: "synthetic finding",
                  evidence: [ordinal === 2 ? 7 : 9],
                },
              ],
              notes: [],
              missing_info: [],
            }),
          ])
        : sse([tool("submit_audit_summary", { turn_id: "a1", markdown: "# Synthetic summary" })]);
    });
    try {
      for (const [index, task] of contexts.entries()) {
        const result = await f.executor.runTurn(task, { timeoutMs: 5000 });
        expect(result).toEqual(
          task.mode === "inspect"
            ? {
                kind: "findings",
                agent: task.taskName,
                findings: [
                  {
                    severity: "low",
                    category: "logging",
                    message: "synthetic finding",
                    evidence: [index === 0 ? 7 : 9],
                    source: task.source,
                  },
                ],
                notes: [],
                missing_info: [],
              }
            : { kind: "summary", markdown: "# Synthetic summary" },
        );
        expect(f.executor.runtimeState.turns).toBe(0);
      }
      await f.executor.close();
      expect(f.executor.runtimeState).toEqual({ closed: true, turns: 0 });
      expect(f.requests).toBe(6);
      expect(f.failures).toEqual([]);
      expect(await f.executor.runTurn(contexts[0]!, { timeoutMs: 1000 })).toBeNull();
      expect(f.requests).toBe(6);
      await expect(access(f.workspace)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await f.executor.close();
      f.server.stop(true);
    }
  }, 15000);

test("Pi audit real plain text cannot impersonate a formal findings submission", async () => {
  const f = await fixture(() => sse([{ content: '{"kind":"findings","findings":[]}' }], "stop"));
  try {
    expect(
      await f.executor.runTurn(
        { locale: "en", mode: "inspect", taskName: "text-only", source: "literal", payload: {} },
        { timeoutMs: 5000 },
      ),
    ).toBeNull();
    expect(f.requests).toBe(1);
    expect(f.failures).toEqual([]);
    await f.executor.close();
    expect(f.executor.runtimeState).toEqual({ closed: true, turns: 0 });
  } finally {
    await f.executor.close();
    f.server.stop(true);
  }
});

for (const stop of ["timeout", "close"] as const)
  test(`Pi audit actual HTTP ${stop} revokes the turn and closes the response stream before returning`, async () => {
    let began!: () => void, cancelled!: () => void;
    const started = new Promise<void>((resolve) => {
        began = resolve;
      }),
      disconnected = new Promise<void>((resolve) => {
        cancelled = resolve;
      });
    let stream: ReadableStreamDefaultController<Uint8Array> | undefined,
      wasCancelled = false;
    const f = await fixture((request) => {
      request.signal.addEventListener(
        "abort",
        () => {
          wasCancelled = true;
          cancelled();
        },
        { once: true },
      );
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            stream = controller;
            began();
          },
          cancel() {
            wasCancelled = true;
            cancelled();
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      );
    });
    const context: AuditToolContext = {
      locale: "en",
      mode: "inspect",
      taskName: "cancelled",
      source: "literal",
      payload: { marker: "CANCELLED_PRIVATE" },
    };
    try {
      const pending = f.executor.runTurn(context, { timeoutMs: stop === "timeout" ? 1000 : 5000 });
      await started;
      if (stop === "close") await f.executor.close();
      expect(await pending).toBeNull();
      // 实际 HTTP 连接断开由服务端看见；这不是仅检查逻辑 turn 数的替身证据。
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          disconnected,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("pi_audit_http_not_cancelled")), 1500);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      expect(wasCancelled).toBe(true);
      const late = sse([
        tool("submit_audit_findings", { turn_id: "a1", findings: [], notes: [], missing_info: [] }),
      ]);
      try {
        stream?.enqueue(new Uint8Array(await late.arrayBuffer()));
        stream?.close();
      } catch {
        /* 客户端已取消，服务端不能再交付迟到候选。 */
      }
      await f.executor.close();
      expect(f.executor.runtimeState).toEqual({ closed: true, turns: 0 });
      expect(await f.executor.runTurn(context, { timeoutMs: 1000 })).toBeNull();
      expect(f.requests).toBe(1);
      expect(f.failures).toEqual([]);
    } finally {
      await f.executor.close();
      f.server.stop(true);
    }
  }, 10000);
