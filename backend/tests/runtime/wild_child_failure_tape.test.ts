import path from "node:path";
import { promises as fs } from "node:fs";
import { expect, spyOn, test } from "bun:test";
import * as runtimeFactory from "../../src/runtime/player_agent_factory";
import { LlmActionProvider } from "../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../src/ai/agents/acp/acp_action_provider";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../src/runtime/config/resolve_game_setup";
import { runGame } from "../../src/runtime/game_runner";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/drivers/temp-directories";
import { wildChildScenario } from "../support/wild_child_scenarios";
import { Role, Camp } from "../../src/core";
for (const transport of ["sdk", "acp"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const failure of ["invalid", "missing"] as const)
      test(`${transport}/${locale}/${failure}: real strict provider failure closes WildChild without fallback or faction change, exact partial Tape`, async () => {
        const scenario = wildChildScenario("wolf_exile", 6, locale),
          root = await createTestTempDirectory("awa-wild_child-failure-"),
          output = await createTestTempDirectory("awa-wild_child-failure-replay-");
        const runtime = parseRuntimeConfig({
          providers: {
            default: "synthetic",
            items: { synthetic: { type: "openai", apiKey: "synthetic-only" } },
          },
          agents: {
            default: "synthetic",
            items: { synthetic: { kind: "llm", provider: "synthetic", model: "synthetic" } },
          },
          game: { board: scenario.board.definition.id, seed: scenario.seed, locale },
          debugSummary: { agent: { enabled: false } },
        });
        const setup = resolveGameSetup(
          runtime,
          {
            recordRootDir: root,
            maxDays: 8,
            maxRuntimeMs: 10000,
            streamEvents: false,
            printThinking: false,
            color: false,
          },
          scenario.board,
        );
        let fallbackCalls = 0,
          nativeCalls = 0;
        const create = spyOn(runtimeFactory, "createPlayerAgentRuntime").mockImplementation(
          async (options) => {
            const fallbackProvider = {
                async getAction() {
                  fallbackCalls++;
                  return null;
                },
              },
              client: any = {
                async chat() {
                  throw new Error("unexpected_chat");
                },
                async runToolLoop(_m: any, _t: any, callbacks: any) {
                  if (failure === "invalid")
                    for (let i = 0; i < 3; i++)
                      await callbacks.onToolCall({
                        name: "submit_action",
                        args: {
                          turn_id: "t1",
                          action: "choose_wild_model",
                          arguments: { target_id: scenario.actorId },
                        },
                      });
                  return { finalAction: null, assistantText: "End" };
                },
              };
            const provider =
              transport === "sdk"
                ? new LlmActionProvider(options.world, client, {
                    boardConfig: options.boardConfig,
                    fallbackProvider,
                  })
                : new AcpActionProvider(options.world, {
                    boardConfig: options.boardConfig,
                    fallbackProvider,
                    sessionFactory: {
                      async createSession(input) {
                        return {
                          sessionId: "wild_child-failure",
                          async prompt() {
                            if (failure === "invalid")
                              for (let i = 0; i < 3; i++)
                                input.registry.submitAction("wild_child-failure", {
                                  turn_id: "t1",
                                  action: "choose_wild_model",
                                  arguments: { target_id: scenario.actorId },
                                });
                          },
                          async cancel() {},
                          async close() {},
                        };
                      },
                    },
                  });
            let closed = false;
            return {
              kind: transport === "sdk" ? "llm" : "acp",
              provider: {
                getAction(r) {
                  if (r.context.stage !== "wild_child") {
                    nativeCalls++;
                    throw new Error("native_before_failed_setup");
                  }
                  return provider.getAction(r);
                },
              },
              get runtimeState() {
                return { closed };
              },
              async close() {
                closed = true;
                await provider.close();
              },
            };
          },
        );
        try {
          await expect(runGame(setup)).rejects.toThrow();
          expect(fallbackCalls).toBe(0);
          expect(nativeCalls).toBe(0);
          const directory = path.join(
              root,
              (await fs.readdir(root)).find((n) => n.startsWith("session_"))!,
            ),
            record = await readReproduction(path.join(directory, "reproduction.json")),
            decision = record.decisions.find((d) => d.stage === "wild_child")!;
          expect(decision.request.context.turn_constraints.min_valid_actions).toBe(1);
          expect(decision.request.context.allow_fallback).toBe(false);
          expect(decision.outcome).toMatchObject({ kind: "error", code: "decision_failed" });
          expect(record.checkpoints.at(-1)!.complete).toBe(false);
          const player = record.checkpoints.at(-1)!.players.find((p) => p.id === scenario.actorId)!;
          expect(player.role).toBe(Role.WildChild);
          expect(player.camp).toBe(Camp.Good);
          expect(player.privateState.wildChild).toMatchObject({
            remaining: 0,
            status: "closed",
            choice: null,
            eligibleNight: null,
            activeFromNight: null,
          });
          expect(record.events.some((e) => e.type.startsWith("wild_child_"))).toBe(false);
          expect((await replayReproduction(record, output)).snapshot).toEqual(
            record.checkpoints.at(-1)!.snapshot,
          );
          if (failure === "invalid") {
            const view = await fs.readFile(
              path.join(directory, `players/player_${scenario.actorId}.json`),
              "utf8",
            );
            expect(view).toContain("turn_invalid_action_limit");
            expect(view).not.toContain("transport_error");
          }
        } finally {
          create.mockRestore();
        }
      }, 10000);
