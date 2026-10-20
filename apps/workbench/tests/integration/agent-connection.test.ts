/** 集成测试负责三后端连接探测的离线反例；输入 localhost HTTP、合成 stdio 与假认证，独立预期核对脱敏结果、超时和真实进程回收。 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { offlineWorkspace, eventually } from "../support/offline-workspace";
import { testAgentConnection } from "@ai-werewolf-arena/game-runtime/config/test-agent-connection";
import type { ResolvedAgentRuntimeProfile } from "@ai-werewolf-arena/game-runtime/app/config/contracts";

test("saved LLM connection testing returns only a result and creates no game or recording", async () => {
  const workspace = await offlineWorkspace();
  try {
    const response = await workspace.application.fetch(
      new Request("http://127.0.0.1:4310/api/test-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"name":"offline"}',
      }),
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({ ok: true, kind: "llm", stage: "complete" });
    expect(JSON.stringify(result)).not.toContain("synthetic-test-only");
    expect(JSON.stringify(result)).not.toContain("Local synthetic turn");
    expect(await workspace.application.sessions.list()).toEqual([]);
    expect(workspace.requestCount()).toBe(1);
  } finally {
    await workspace.close();
  }
});

test("LLM authentication failure preserves HTTP status without response text or retrying", async () => {
  let requests = 0;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch() {
      requests++;
      return Response.json({ error: { message: "synthetic-private-rejection" } }, { status: 401 });
    },
  });
  try {
    const result = await testAgentConnection({
      name: "test",
      providerName: "test",
      kind: "llm",
      model: "test",
      provider: { type: "openai", apiKey: "synthetic-key", baseURL: `${server.url.origin}/v1` },
    });
    expect(result).toMatchObject({
      ok: false,
      kind: "llm",
      stage: "request",
      diagnostic: { code: "authentication_failed", statusCode: 401 },
    });
    expect(JSON.stringify(result)).not.toContain("synthetic");
    expect(requests).toBe(1);
  } finally {
    await server.stop(true);
  }
});

test("a second connection test is rejected while the first request is running", async () => {
  const workspace = await offlineWorkspace();
  workspace.slow();
  const request = () =>
    workspace.application.fetch(
      new Request("http://127.0.0.1:4310/api/test-agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"name":"offline"}',
      }),
    );
  const first = request();
  try {
    await eventually(
      async () => workspace.requestCount(),
      (count) => count > 0,
    );
    const second = await request();
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: "connection_test_busy" });
    expect((await first).status).toBe(200);
    expect(workspace.requestCount()).toBe(1);
  } finally {
    await first;
    await workspace.close();
  }
});

test("Pi connection testing uses the real in-memory session with no tools", async () => {
  let observedTools: unknown;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const body = (await request.json()) as { tools?: unknown };
      observedTools = body.tools;
      const chunk = {
        id: "probe",
        object: "chat.completion.chunk",
        created: 0,
        model: "probe",
        choices: [{ index: 0, delta: { role: "assistant", content: "OK" }, finish_reason: null }],
      };
      return new Response(
        `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify({ ...chunk, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
        { headers: { "content-type": "text/event-stream" } },
      );
    },
  });
  try {
    const result = await testAgentConnection({
      name: "test",
      providerName: "test",
      kind: "pi",
      piSettings: {
        defaultProvider: "awa-probe",
        defaultModel: "probe",
        defaultThinkingLevel: "off",
      },
      provider: {
        type: "pi",
        models: {
          providers: {
            "awa-probe": {
              baseUrl: `${server.url.origin}/v1`,
              api: "openai-completions",
              models: [{ id: "probe", reasoning: false }],
            },
          },
        },
        auth: { "awa-probe": { type: "api_key", key: "synthetic" } },
      },
    });
    expect(result).toMatchObject({ ok: true, kind: "pi", stage: "complete" });
    expect(
      observedTools === undefined || (Array.isArray(observedTools) && !observedTools.length),
    ).toBe(true);
  } finally {
    await server.stop(true);
  }
});

for (const hang of [false, true])
  test(`ACP connection test ${hang ? "times out and reclaims" : "gets a reply without game tools and closes"} its real process`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-probe-acp-"));
    try {
      const profile: ResolvedAgentRuntimeProfile = {
        name: "acp",
        providerName: "acp",
        kind: "acp",
        provider: {
          type: "acp",
          transport: "stdio",
          command: process.execPath,
          args: [path.resolve(import.meta.dir, "../support/connection-acp.ts")],
          cwd: root,
          env: { AWA_TEST_PROBE_HANG: hang ? "1" : "0" },
          sessionConfigOptions: {},
        },
      };
      const result = await testAgentConnection(profile, { timeoutMs: hang ? 1500 : 10000 });
      expect(result.ok).toBe(!hang);
      if (hang)
        expect(result).toMatchObject({
          stage: "initialize",
          diagnostic: { code: "request_timeout" },
        });
      const facts = JSON.parse(await fs.readFile(path.join(root, "connection-facts.json"), "utf8"));
      if (!hang) expect(facts.mcpServers).toEqual([]);
      expect(result.cleanupFailed).toBeUndefined();
      let alive = true;
      try {
        process.kill(facts.pid, 0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") alive = false;
        else throw error;
      }
      expect(alive).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
