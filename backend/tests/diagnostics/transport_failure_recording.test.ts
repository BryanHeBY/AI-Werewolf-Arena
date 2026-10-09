import { expect, test } from "bun:test";
import { RetryError } from "ai";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assertReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { bootstrapGame } from "../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../src/ai/agents/acp/acp_action_provider";
import type { ChatModelClient } from "../../src/ai/integrations/llm/transport";
import { AiSdkClient } from "../../src/ai/integrations/llm/ai_sdk_client";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../src/recording/recording_context";
import { createTestTempDirectory } from "../support/temp_directory";
import { createAcpConsoleLogger } from "../../src/runtime/console_presenter";
import { ReplayFileStore } from "../../src/recording/file_store";
import { Phase, Role, type ActionRequest } from "../../src/core";
import { describeError } from "../../src/utils/error_diagnostic";

const secret = "synthetic-private-transport-canary";
const request: ActionRequest = {
  actorId: 1,
  phase: Phase.Day,
  allowedTools: ["speak"],
  context: {
    day: 1,
    stage: "day_speech",
    visible_events: [],
    turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
  },
};
const fallback = { name: "speak" as const, args: { text: "Original 茶茶 fallback" } };
const failure = () =>
  new RetryError({
    message: secret,
    reason: "maxRetriesExceeded",
    errors: [
      Object.assign(new Error(secret), {
        statusCode: 429,
        isRetryable: true,
        responseHeaders: { "retry-after": "1", authorization: secret },
        url: `https://host/${secret}`,
        responseBody: secret,
      }),
    ],
  });

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["llm", "acp"] as const)
    test(`${kind}/${locale}: provider failure keeps safe facts, original prompts and the existing fallback`, async () => {
      const root = await createTestTempDirectory("awa-error-private-");
      const displayLocale = locale === "en" ? "zh-CN" : "en";
      const { world } = bootstrapGame(sixPlayerMvpConfig, {
        locale,
        fixedRoles: [Role.Seer, Role.Wolf, Role.Guard, Role.Villager, Role.Wolf, Role.Villager],
      });
      const manager = await SessionRecordManager.create(
        {
          sessionId: "failure",
          locale,
          board: "synthetic",
          startedAtIso: "2026-10-08T00:00:00.000Z",
        },
        root,
        displayLocale,
      );
      let calls = 0,
        fallbacks = 0,
        closed = 0;
      const lines: string[] = [];
      const previousLog = console.log;
      console.log = (...values) => {
        lines.push(values.join(" "));
      };
      const fallbackProvider = {
        async getAction() {
          fallbacks++;
          return fallback;
        },
      };
      const provider =
        kind === "llm"
          ? LlmActionProvider.fromModelClient(
              world,
              {
                async chat() {
                  throw new Error("unexpected chat");
                },
                async runToolLoop() {
                  calls++;
                  throw failure();
                },
              } as ChatModelClient,
              { trace: true, displayLocale, fallbackProvider, llmTimeoutMs: 1000 },
            )
          : new AcpActionProvider(world, {
              turnTimeoutMs: 1000,
              fallbackProvider,
              sessionFactory: {
                async createSession() {
                  return {
                    sessionId: "synthetic-session",
                    async prompt() {
                      calls++;
                      throw failure();
                    },
                    async cancel() {},
                    async close() {
                      closed++;
                    },
                  };
                },
              },
            });
      try {
        await runWithSessionRecorder(manager, async () => {
          expect(await provider.getAction(request)).toEqual(fallback);
          if (provider instanceof AcpActionProvider) await provider.close();
          await manager.finalize({
            endedAtIso: "2026-10-08T00:01:00.000Z",
            winner: null,
            finishReason: "completed",
            players: [],
          });
        });
      } finally {
        console.log = previousLog;
      }
      if (kind === "llm") {
        const diagnosticLine = lines.find((line) => line.includes("request_sdk_attempt_fail"))!;
        expect(diagnosticLine).toContain(displayLocale === "en" ? "rate limited" : "限流");
      }
      expect(calls).toBe(1);
      expect(fallbacks).toBe(1);
      if (kind === "acp") expect(closed).toBe(1);
      const raw = await fs.readFile(path.join(root, "failure/players/player_1.json"), "utf8");
      expect(raw).not.toContain(secret);
      expect(lines.join("\n")).not.toContain(secret);
      const view = JSON.parse(raw);
      assertReplayPlayerView(view);
      expect(view.locale).toBe(locale);
      const turn = view.timeline.find((entry) => entry.kind === "turn");
      if (!turn || turn.kind !== "turn") throw new Error("fixture missing turn");
      const diagnostic = turn.delta_messages.find((item) => item.kind === "request_error");
      expect(diagnostic?.content).toBe("rate_limited");
      expect(diagnostic?.diagnostic).toEqual({
        code: "rate_limited",
        statusCode: 429,
        retryable: true,
        retryAfterMs: 1000,
      });
      expect(raw).toContain("Original 茶茶 fallback");
      const logic = await fs.readFile(path.join(root, "failure/logic_ops.json"), "utf8");
      expect(logic).not.toContain(secret);
    });

test("actual installed SDK HTTP error metadata is safe in private replay and terminal diagnostics", async () => {
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      requests++;
      return Response.json(
        { error: { message: secret, type: "invalid_api_key", code: "invalid_api_key" } },
        { status: 401, headers: { authorization: secret } },
      );
    },
  });
  const root = await createTestTempDirectory("awa-sdk-error-");
  const { world } = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  const manager = await SessionRecordManager.create(
    {
      sessionId: "http",
      locale: "en",
      board: "synthetic",
      startedAtIso: "2026-10-08T00:00:00.000Z",
    },
    root,
  );
  const client = new AiSdkClient({
    apiKey: secret,
    providerName: "synthetic",
    baseURL: `${server.url.origin}/v1`,
    model: "synthetic",
  });
  const provider = LlmActionProvider.fromModelClient(world, client, {
    fallbackProvider: {
      async getAction() {
        return fallback;
      },
    },
    trace: true,
    llmTimeoutMs: 2000,
  });
  const lines: string[] = [];
  const original = console.log;
  console.log = (...values) => {
    lines.push(values.join(" "));
  };
  try {
    await runWithSessionRecorder(manager, async () => {
      expect(await provider.getAction(request)).toEqual(fallback);
      await manager.finalize({
        endedAtIso: "2026-10-08T00:01:00.000Z",
        winner: null,
        finishReason: "completed",
        players: [],
      });
    });
    expect(requests).toBe(1); // Non-retryable 401 still follows the installed SDK policy.
    const raw = await fs.readFile(path.join(root, "http/players/player_1.json"), "utf8");
    expect(raw).not.toContain(secret);
    expect(lines.join("\n")).not.toContain(secret);
    expect(raw).toContain('"authentication_failed"');
    expect(raw).toContain('"statusCode": 401');
    expect(lines.join("\n")).toContain("rejected authentication");
  } finally {
    console.log = original;
    server.stop(true);
  }
});

test("ACP error updates and file warnings drop opaque provider fields, keeping model text untouched", async () => {
  const lines: string[] = [];
  const observer = createAcpConsoleLogger(
    1,
    (line) => {
      lines.push(line);
    },
    "en",
  );
  observer({ sessionUpdate: "agent_thought_chunk", content: { text: "Original raw 思考" } });
  observer({ sessionUpdate: "tool_call", toolCallId: "c1", title: "submit_action" });
  observer({
    sessionUpdate: "tool_call_update",
    toolCallId: "c1",
    status: "failed",
    error: failure(),
  });
  observer.flush();
  expect(lines.join("\n")).toContain("Original raw 思考");
  expect(lines.join("\n")).not.toContain(secret);
  expect(lines.join("\n")).toContain('"statusCode":429');
  const store = new ReplayFileStore("/unused/synthetic", "en");
  Object.defineProperty(store, "writeAtomic", {
    value: async () => {
      throw Object.assign(new Error(secret), { code: "EACCES", path: secret });
    },
  });
  const warnings: string[] = [];
  const previous = console.warn;
  console.warn = (...values) => {
    warnings.push(values.join(" "));
  };
  try {
    await store.writeText("synthetic.txt", "Original text");
  } finally {
    console.warn = previous;
  }
  expect(warnings.join("\n")).not.toContain(secret);
  expect(warnings.join("\n")).toContain("filesystem operation");
  expect(describeError(new Error("acp_provider_closed"))).toEqual({ code: "request_aborted" });
});

test("recording and inspection warning language is transient display context, not game metadata", async () => {
  const { AuditTaskRunner } = await import("../../src/audit/task_runner");
  const root = await createTestTempDirectory("awa-diagnostic-display-");
  const manager = await SessionRecordManager.create(
    {
      sessionId: "display",
      locale: "zh-CN",
      board: "synthetic",
      startedAtIso: "2026-10-08T00:00:00.000Z",
    },
    root,
    "en",
  );
  const warnings: string[] = [],
    taskLocales: string[] = [];
  const previous = console.warn;
  console.warn = (...values) => {
    warnings.push(values.join(" "));
  };
  try {
    const runner = new AuditTaskRunner(
      {
        async runTurn(context) {
          taskLocales.push(context.locale!);
          throw failure();
        },
        async close() {},
      },
      "synthetic",
      { timeoutMs: 100, maxAttempts: 1, concurrency: 1, displayLocale: "en" },
    );
    await runner.run([{ name: "synthetic", locale: "zh-CN", source: "synthetic", payload: {} }]);
    const store = (manager as unknown as { store: ReplayFileStore }).store;
    Object.defineProperty(store, "writeAtomic", {
      value: async () => {
        throw failure();
      },
    });
    await store.writeText("synthetic.txt", "Original");
    expect(warnings.join("\n")).toContain("rate limited");
    expect(warnings.join("\n")).not.toContain("限流");
    expect(warnings.join("\n")).not.toContain(secret);
    expect(taskLocales).toEqual(["zh-CN"]);
  } finally {
    console.warn = previous;
  }
  expect(
    JSON.parse(await fs.readFile(path.join(root, "display/manifest.json"), "utf8")).locale,
  ).toBe("zh-CN");
});

test("game CLI rejects invalid provider configuration without exposing JSON or a second uncaught exception", async () => {
  const { configDiagnostic } = await import("../../src/runtime/cli/check_config");
  let reads = 0;
  const foreign = Object.defineProperty(new Error(), "message", {
    get() {
      reads++;
      throw new Error(secret);
    },
  });
  expect(configDiagnostic(foreign)).toEqual({ code: "config_check_failed" });
  expect(reads).toBe(0);
  const { BoardConfigurationError } = await import("../../src/runtime/config/board_definition");
  const typed = Object.defineProperty(
    new BoardConfigurationError("board_config_invalid_field", "roles.witch"),
    "fieldPath",
    {
      get() {
        reads++;
        throw new Error(secret);
      },
    },
  );
  expect(configDiagnostic(typed)).toEqual({ code: "board_config_invalid_field" });
  expect(reads).toBe(0);
  expect(
    configDiagnostic(
      new Proxy(new Error(secret), {
        getPrototypeOf() {
          throw new Error(secret);
        },
      }),
    ),
  ).toEqual({ code: "config_check_failed" });
  expect(configDiagnostic(new Error(`runtime_config_${secret.replaceAll("-", "_")}`))).toEqual({
    code: "config_check_failed",
  });
  const root = await createTestTempDirectory("awa-diagnostic-cli-");
  await fs.mkdir(path.join(root, "runtime"));
  await fs.writeFile(path.join(root, "runtime/providers.json"), `{"key":"${secret}",INVALID}`);
  const command = path.resolve(import.meta.dir, "../../src/runtime/cli/run_game.ts");
  const child = Bun.spawn(
    [Bun.env.BUN_RUNTIME_EXECUTABLE ?? "bun", command, "--configs-dir", root],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(code).toBe(1);
  expect(stdout + stderr).not.toContain(secret);
  expect(stderr).toContain("runtime_config_json_invalid");
  expect(stderr).not.toContain(" at ");
});
