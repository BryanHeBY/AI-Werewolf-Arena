/**
 * 场景测试使用真实 runner、三种 Agent 编排和内存传输重现遗言超时，不连接外部模型。
 * 非遗言行动是显式特权测试脚本：预先读取初始狼人名单，仅供构造两日手写胜负预期。
 * 断言普通遗言期满不发表、不关闭整局，后续请求继续，严格 Tape 在无重放时钟时仍精确一致。
 */
import { expect, spyOn, test } from "bun:test";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import * as factory from "../../../src/app/player-agent-factory";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../src/app/config/resolve-game-setup";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { runGame } from "../../../src/app/game-runner";
import {
  readReproduction,
  replayReproduction,
} from "../../../src/app/simulation/replay-reproduction";
import { PiActionProvider } from "../../../src/agents/pi/pi-action-provider";
import { LlmActionProvider } from "../../../src/agents/llm/llm-action-provider";
import { AcpActionProvider } from "../../../src/agents/acp/acp-action-provider";
import { COMPONENT, Role, Camp, type ActionRequest, type ToolCall } from "../../../src/domain";
import { readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

for (const transport of ["llm", "acp", "pi"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`${transport}/${locale}: 遗言模型超时后继续到第二日终局，保留真实超时并精确复现`, async () => {
      const root = await createTestTempDirectory("awa-last-words-timeout-");
      const output = await createTestTempDirectory("awa-last-words-timeout-replay-");
      const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../configs.example"),
        "six_player_mvp",
      );
      const config =
        transport === "pi"
          ? { kind: "pi", config: { models: { providers: {} }, auth: {} } }
          : transport === "acp"
            ? { kind: "acp", config: { transport: "stdio", command: "synthetic-only" } }
            : { kind: "llm", config: { type: "openai", apiKey: "synthetic-only" } };
      const options =
        transport === "pi"
          ? {
              defaultProvider: "openai",
              defaultModel: "gpt-6-luna",
              defaultThinkingLevel: "low",
              cacheWarming: "off",
            }
          : transport === "llm"
            ? { model: "synthetic" }
            : {};
      const runtime = parseRuntimeConfig({
        backends: { schemaVersion: 2, items: { memory: config } },
        agents: {
          schemaVersion: 2,
          default: "memory",
          items: { memory: { backend: "memory", options } },
        },
        game: {
          board: "six_player_mvp",
          agent: "memory",
          locale,
          seed: "last-words-timeout",
          maxDays: 3,
        },
        debugSummary: { agent: { enabled: false } },
      });
      const setup = resolveGameSetup(
        runtime,
        {
          recordRootDir: root,
          maxRuntimeMs: 10_000,
          llmTimeoutMs: 1000,
          streamEvents: false,
          printThinking: false,
          color: false,
        },
        board,
      );
      let victim = 0,
        closed = false,
        timedOut = false,
        nextDay = false;
      const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(
        async (input) => {
          const wolves = input.world
            .entityIds()
            .filter((id) => input.world.getComponent(id, COMPONENT.Role)?.role === Role.Wolf);
          victim = wolves[0]!;
          const shared = { boardConfig: input.boardConfig, outputSink: input.outputSink };
          const wait = (signal: AbortSignal) =>
            new Promise<never>((_resolve, reject) => {
              if (signal.aborted) reject(signal.reason);
              else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
            });
          const delegate =
            transport === "llm"
              ? new LlmActionProvider(
                  input.world,
                  {
                    async chat() {
                      return "";
                    },
                    async runToolLoop(_messages, _tools, _callbacks, settings) {
                      return wait(settings!.signal!);
                    },
                  },
                  { ...shared, llmTimeoutMs: 1000 },
                )
              : transport === "acp"
                ? new AcpActionProvider(input.world, {
                    ...shared,
                    turnTimeoutMs: 1000,
                    sessionFactory: {
                      async createSession() {
                        let finish!: () => void;
                        return {
                          sessionId: "memory-timeout",
                          async prompt() {
                            await new Promise<void>((resolve) => {
                              finish = resolve;
                            });
                          },
                          async cancel() {
                            finish?.();
                          },
                          async close() {
                            finish?.();
                          },
                        };
                      },
                    },
                  })
                : new PiActionProvider(input.world, {
                    ...shared,
                    turnTimeoutMs: 1000,
                    settingsResolver: () => ({}),
                    runtime: {
                      async createSession() {
                        return {
                          async prompt(_text, settings) {
                            return wait(settings.signal!);
                          },
                          takeTrace() {
                            return {
                              finalAction: null,
                              assistantText: "",
                              thinkingText: "synthetic prolonged thinking",
                              toolCalls: [],
                              events: [],
                            };
                          },
                          async close() {},
                        };
                      },
                      async close() {},
                    },
                  });
          const scripted = (request: ActionRequest): ToolCall | null => {
            if (request.context.day === 2) {
              nextDay = true;
              expect(closed).toBe(false);
            }
            const tool = request.allowedTools[0];
            if (tool === "speak_to_wolves")
              return { name: tool, args: { text: "End chat", end_chat: true } };
            if (tool === "kill_vote")
              return { name: tool, args: { target_id: null, abstain: true } };
            if (tool === "guard") return { name: tool, args: { target_id: null, abstain: true } };
            if (tool === "check_identity")
              return {
                name: tool,
                args: { target_id: wolves[Math.min(request.context.day - 1, wolves.length - 1)]! },
              };
            if (tool === "vote")
              return {
                name: tool,
                args: {
                  target_id: wolves[Math.min(request.context.day - 1, wolves.length - 1)]!,
                  abstain: false,
                },
              };
            if (tool === "speak") return { name: tool, args: { text: "Literal scripted speech" } };
            throw new Error("unexpected_script_request");
          };
          return {
            kind: transport,
            provider: {
              async getAction(request) {
                if (request.actorId === victim && request.context.stage === "last_words") {
                  timedOut = true;
                  return delegate.getAction(request);
                }
                return scripted(request);
              },
            },
            get runtimeState() {
              return { closed };
            },
            async close() {
              closed = true;
              await delegate.close();
            },
          } as Awaited<ReturnType<typeof factory.createPlayerAgentRuntime>>;
        },
      );
      try {
        const result = await runGame(setup, {
          selectRequestDeadline(request) {
            return request.stage === "last_words" && request.actorId === victim
              ? request.nowMs + 45
              : undefined;
          },
        });
        expect(result.snapshot.result?.winner).toBe(Camp.Good);
        expect(timedOut).toBe(true);
        expect(nextDay).toBe(true);
        expect(closed).toBe(true);
        const [session] = await readdir(root),
          record = await readReproduction(path.join(root, session!, "reproduction.json"));
        const decision = record.decisions.find(
          (d) => d.actorId === victim && d.stage === "last_words",
        )!;
        expect(decision.outcome).toEqual({
          kind: "error",
          code: "request_delivery_expired",
          name: "Error",
        });
        expect(Object.hasOwn(decision, "returnedCandidate")).toBe(false);
        expect(record.termination!.reason).not.toBe("runtime_error");
        expect(record.termination!.errors).toEqual([]);
        expect(
          record.events.some(
            (e) => e.type === "last_words_spoken" && e.payload.playerId === victim,
          ),
        ).toBe(false);
        expect(record.checkpoints.at(-1)!.snapshot).toMatchObject({ day: 2, gameOver: true });
        const view = readReplayPlayerView(
          JSON.parse(
            await readFile(path.join(root, session!, `players/player_${victim}.json`), "utf8"),
          ),
        );
        const last = view.timeline.find((t) => t.kind === "turn" && t.stage === "last_words");
        expect(last?.kind).toBe("turn");
        if (last?.kind === "turn") {
          const summary = last.delta_messages.find((m) => m.kind === "action_summary")!;
          expect(JSON.parse(summary.content!)).toEqual({ action_mode: "none", final_action: null });
        }
        const replay = await replayReproduction(record, output);
        expect(replay.decisionCount).toBe(record.decisions.length);
        expect(replay.eventCount).toBe(record.events.length);
      } finally {
        create.mockRestore();
      }
    });
