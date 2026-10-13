/**
 * 集成测试验证 safe-transport-fallback 的原权限和记录边界。输入为原 fixture、请求及显式故障／特权回调；原字面量、引用身份与错误／状态断言为预期。测试注入保留原请求，领域合法性与付款仍由原被测 owner 执行。
 */
import { expect, test } from "bun:test";
import { RetryError } from "ai";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assertReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../../../src/ai/agents/acp/acp_action_provider";
import type { ChatModelClient } from "../../../../src/ai/integrations/llm/transport";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { ReplayFileStore } from "../../../../src/recording/file_store";
import { Phase, Role, type ActionRequest } from "../../../../src/core";

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
      const privilegedFallbackProvider = {
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
              { trace: true, displayLocale, privilegedFallbackProvider, llmTimeoutMs: 1000 },
            )
          : new AcpActionProvider(world, {
              turnTimeoutMs: 1000,
              privilegedFallbackProvider,
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

test("recording and inspection warning language is transient display context, not game metadata", async () => {
  const { AuditTaskRunner } = await import("../../../../src/audit/task_runner");
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
