/**
 * Agent logging integration verify IO/thinking/trace flags and close-time suppression on both transports.
 * Input: Actual SDK/ACP synthetic agents, console spies, late callbacks and saved player rounds.
 * Output and independent oracle: Literal output prefixes, identical accepted records and no late actions/private round writes after close.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, spyOn, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { text } from "@ai-werewolf-arena/game-text";
import { bootstrapGame } from "../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { createPlayerAgentRuntime } from "../../src/runtime/player_agent_factory";
import { createAcpConsoleLogger } from "../../src/runtime/console_presenter";
import { Phase, type ActionRequest } from "../../src/core";
import type { ResolvedAgentRuntimeProfile } from "../../src/runtime/config/contracts";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../src/recording/recording_context";
import { createTestTempDirectory } from "../support/drivers/temp-directories";

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
for (const locale of ["zh-CN", "en"] as const)
  for (const printThinking of [false, true])
    for (const printLlmIo of [false, true])
      test(`${locale}: SDK and actual ACP share IO/thinking flag semantics (${printLlmIo}/${printThinking}) without affecting records`, async () => {
        const root = await createTestTempDirectory("awa-log-flags-"),
          outputs: Record<string, string> = {};
        const server = Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          async fetch(input) {
            const body = (await input.json()) as any,
              turn = /turn_id must be (t\d+)/.exec(body.messages.at(-1).content)![1];
            return Response.json({
              id: "logging",
              object: "chat.completion",
              created: 1,
              model: "synthetic",
              choices: [
                {
                  index: 0,
                  finish_reason: "tool_calls",
                  message: {
                    role: "assistant",
                    content: "raw-model-message",
                    tool_calls: [
                      {
                        id: "call",
                        type: "function",
                        function: {
                          name: "submit_action",
                          arguments: JSON.stringify({
                            turn_id: turn,
                            action: "speak",
                            arguments: { text: "selected" },
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            });
          },
        });
        try {
          for (const kind of ["llm", "acp"] as const) {
            const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" }),
              lines: string[] = [];
            const log = spyOn(console, "log").mockImplementation((...values) => {
              lines.push(values.join(" "));
            });
            const profile: ResolvedAgentRuntimeProfile =
              kind === "llm"
                ? {
                    name: "synthetic",
                    providerName: "synthetic",
                    kind,
                    model: "synthetic",
                    provider: {
                      type: "openai",
                      apiKey: "synthetic-private-auth",
                      baseURL: `${server.url.origin}/v1`,
                    },
                  }
                : {
                    name: "synthetic",
                    providerName: "synthetic",
                    kind,
                    provider: {
                      type: "acp",
                      transport: "stdio",
                      command: process.execPath,
                      args: [path.resolve(process.cwd(), "tests/fixtures/acp_ownership_agent.ts")],
                      env: {
                        AWA_TEST_ACTOR: "1",
                        AWA_TEST_LOGGING: "1",
                        SYNTHETIC_SECRET: "synthetic-private-env",
                      },
                      sessionConfigOptions: {},
                    },
                  };
            const record = await SessionRecordManager.create(
              {
                sessionId: `flags-${kind}-${printLlmIo}-${printThinking}`,
                board: "six_player_mvp",
                locale: "en",
                startedAtIso: new Date().toISOString(),
              },
              root,
              locale,
            );
            const runtime = await createPlayerAgentRuntime({
              world: game.world,
              boardConfig: sixPlayerMvpConfig,
              profilesByActor: new Map([[1, profile]]),
              acpWorkspaceRoot: path.join(root, `workspace-${kind}`),
              llmTimeoutMs: 2000,
              trace: false,
              displayLocale: locale,
              colorizeLogs: false,
              printLlmIo,
              printThinking,
              createAcpUpdateObserver: (actor) =>
                createAcpConsoleLogger(actor, (line) => lines.push(line), locale, {
                  printThinking,
                  printLlmIo,
                }),
            });
            try {
              expect(
                await runWithSessionRecorder(record, () => runtime.provider.getAction(request)),
              ).toEqual({ name: "speak", args: { text: kind === "llm" ? "selected" : "actor-1" } });
              await runtime.close();
              outputs[kind] = lines.join("\n");
              expect(outputs[kind].includes("prompt_start")).toBe(printLlmIo);
              expect(outputs[kind].includes("raw-model-message")).toBe(printLlmIo || printThinking);
              expect(outputs[kind].includes(kind === "llm" ? "[THINKING]" : "[thought]")).toBe(
                printThinking,
              );
              if (kind === "acp")
                expect(outputs[kind].includes("private-thought-delta")).toBe(printThinking);
              if (printLlmIo) expect(outputs[kind]).toContain(text(locale, "runtime.prompt_start"));
              expect(outputs[kind]).not.toContain("synthetic-private-auth");
              expect(outputs[kind]).not.toContain("synthetic-private-env");
              await record.flushNow();
              const stored = JSON.parse(
                await readFile(path.join(record.sessionDir, "players/player_1.json"), "utf8"),
              );
              const round = stored.timeline.find((item: any) => item.kind === "turn");
              expect(round.delta_messages.some((message: any) => message.kind === "prompt")).toBe(
                true,
              );
              const summary = round.delta_messages.find(
                (message: any) => message.kind === "action_summary",
              );
              expect(JSON.parse(summary.content).final_action).toEqual({
                name: "speak",
                args: { text: kind === "llm" ? "selected" : "actor-1" },
              });
              if (kind === "acp")
                expect(
                  round.delta_messages.some(
                    (message: any) =>
                      message.kind === "assistant_output" &&
                      message.content.includes("private-thought-delta"),
                  ),
                ).toBe(true);
            } finally {
              log.mockRestore();
              await runtime.close();
            }
          }
        } finally {
          server.stop(true);
        }
      }, 15000);

test("ACP trace is independent of payload flags and retains safe display diagnostics", async () => {
  const { AcpActionProvider } = await import("../../src/ai/agents/acp/acp_action_provider");
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" }),
    lines: string[] = [];
  const log = spyOn(console, "log").mockImplementation((...values) => {
    lines.push(values.join(" "));
  });
  const error = Object.assign(new Error("synthetic-private-error-body"), { statusCode: 429 });
  const provider = new AcpActionProvider(game.world, {
    trace: true,
    displayLocale: "zh-CN",
    printLlmIo: false,
    printThinking: false,
    turnTimeoutMs: 1000,
    sessionFactory: {
      async createSession() {
        throw error;
      },
    },
    fallbackProvider: {
      async getAction() {
        return null;
      },
    },
  });
  try {
    expect(await provider.getAction(request)).toBeNull();
    expect(lines.join("\n")).toContain("[ACPActionProvider]");
    expect(lines.join("\n")).not.toContain("prompt_start");
    expect(lines.join("\n")).not.toContain(error.message);
  } finally {
    log.mockRestore();
    await provider.close();
  }
});

for (const trigger of [
  "request_start",
  "prompt_system",
  "prompt_user",
  "request_ok",
  "request_recovered",
  "request_transport_fail",
] as const)
  test(`ACP logging close at ${trigger} suppresses late actions and private round writes`, async () => {
    const { AcpActionProvider } = await import("../../src/ai/agents/acp/acp_action_provider");
    const { PlayerRoundRecorder } =
      await import("../../src/ai/agents/player/player_round_recorder");
    let closing: Promise<void> | undefined,
      creates = 0,
      prompts = 0,
      fallbacks = 0;
    const record = spyOn(PlayerRoundRecorder.prototype, "record").mockImplementation(() => {});
    const provider = new AcpActionProvider(
      bootstrapGame(sixPlayerMvpConfig, { locale: "en" }).world,
      {
        trace: true,
        printLlmIo: true,
        displayLocale: "en",
        turnTimeoutMs: 1000,
        sessionFactory: {
          async createSession(input) {
            creates++;
            if (trigger === "request_transport_fail" || trigger === "request_recovered")
              throw new Error("synthetic-model-failure");
            return {
              sessionId: "logging-close",
              async prompt(prompt) {
                prompts++;
                const turn = /Current turn ID: (t\d+)/.exec(prompt)![1];
                input.registry.submitAction("logging-close", {
                  turn_id: turn,
                  action: "speak",
                  arguments: { text: "late" },
                });
              },
              async cancel() {},
              async close() {},
            };
          },
        },
        fallbackProvider: {
          async getAction() {
            fallbacks++;
            return { name: "speak", args: { text: "fallback" } };
          },
        },
      },
    );
    const log = spyOn(console, "log").mockImplementation((...values) => {
      if (values.join(" ").includes(trigger)) closing ??= provider.close();
    });
    try {
      expect(await provider.getAction(request)).toBeNull();
      await closing;
      expect(record).not.toHaveBeenCalled();
      expect(provider.runtimeState.turns).toBe(0);
      expect(provider.runtimeState.pool).toEqual({
        closed: true,
        sessions: 0,
        creating: 0,
        retiring: 0,
      });
      if (trigger === "request_start" || trigger === "prompt_system") expect(creates).toBe(0);
      if (trigger === "prompt_user") expect(prompts).toBe(0);
      expect(fallbacks).toBe(trigger === "request_recovered" ? 1 : 0);
    } finally {
      log.mockRestore();
      record.mockRestore();
      await provider.close();
    }
  });
