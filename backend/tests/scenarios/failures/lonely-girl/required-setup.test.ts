/**
 * Failure scenarios verify real strict Lonely Girl providers close required admiration setup without fallback, native action or card swap.
 * Input: Original invalid/missing SDK or ACP responses, the real runner and temporary partial archives followed by offline replay.
 * Output and oracle: Explicit failed admiration/stock/affiliation values and exact prefix replay preserve the original identity; no live provider credential is used.
 */
import { expect, spyOn, test } from "bun:test";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as runtimeFactory from "../../../../src/runtime/player_agent_factory";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../../../src/ai/agents/acp/acp_action_provider";
import { parseRuntimeConfig } from "../../../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../../../src/runtime/config/resolve_game_setup";
import { runGame } from "../../../../src/runtime/game_runner";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { lonelyGirlScenario } from "../../../support/lonely_girl_scenarios";
for (const transport of ["sdk", "acp"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const failure of ["invalid", "missing"] as const)
      test(`${transport}/${locale}/${failure}: real strict provider failure closes Lonely Girl without fallback or card swap, exact partial Tape`, async () => {
        const scenario = lonelyGirlScenario("wolf_alive", 6, locale),
          root = await createTestTempDirectory("awa-lonely_girl-failure-"),
          output = await createTestTempDirectory("awa-lonely_girl-failure-replay-");
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
                          action: "choose_admired_player",
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
                          sessionId: "lonely_girl-failure",
                          async prompt() {
                            if (failure === "invalid")
                              for (let i = 0; i < 3; i++)
                                input.registry.submitAction("lonely_girl-failure", {
                                  turn_id: "t1",
                                  action: "choose_admired_player",
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
                  if (r.context.stage !== "lonely_girl") {
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
            decision = record.decisions.find((d) => d.stage === "lonely_girl")!;
          expect(decision.request.context.turn_constraints.min_valid_actions).toBe(1);
          expect(decision.request.context.allow_fallback).toBe(false);
          expect(decision.outcome).toMatchObject({ kind: "error", code: "decision_failed" });
          expect(record.checkpoints.at(-1)!.complete).toBe(false);
          expect(record.checkpoints.at(-1)!.lonelyGirlSetup).toEqual({
            policy: "awa_netease_lonely_girl_v1",
            status: "failed",
            actorId: scenario.actorId,
          });
          expect(
            record.checkpoints.at(-1)!.players.find((p) => p.id === scenario.actorId)!.privateState
              .lonelyGirl,
          ).toEqual({ policy: "awa_netease_lonely_girl_v1", remaining: 0, choice: null });
          expect(
            record.checkpoints.at(-1)!.players.find((p) => p.id === scenario.actorId)!.victory
              .affiliations,
          ).toEqual([]);
          expect(record.events.some((e) => e.type === "lonely_girl_admired_chosen")).toBe(false);
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
