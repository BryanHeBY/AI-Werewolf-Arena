/**
 * 场景测试验证 required-affiliation-choice 的原请求、已付行动与失败记录链。输入保留原固定角色、动作脚本、故障与归档矩阵；原字面结果及检查点作为预期。显式特权回退仅服务该控制驱动，不将生产对局输出称作独立玩法 oracle。
 */
import { readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Role, WinCondition, type RoleComponent } from "../../../../src/core";
import type { VictoryComponent } from "../../../../src/core/domain/components/victory";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { getHybridState } from "../../../../src/game/mechanisms/roles/hybrid/ports";
import { AiSdkClient } from "../../../../src/ai/integrations/llm/ai_sdk_client";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../../../src/ai/agents/acp/acp_action_provider";
import { BaselineBotActionProvider } from "../../../../src/game/drivers/privileged-baseline";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../../src/runtime/simulation/reproduction_context";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/runtime/simulation/replay_reproduction";

for (const locale of ["zh-CN", "en"] as const)
  for (const transport of ["sdk", "acp"] as const)
    for (const failure of ["empty", "transport"] as const)
      test(`${locale}/${transport}/${failure}: actual failed required Hybrid path never invokes even an injected action fallback`, async () => {
        const roles = [Role.Hybrid, Role.Wolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager],
          config = {
            ...sixPlayerMvpConfig,
            roleSetups: [...new Set(roles)].map((role) => ({
              role,
              count: roles.filter((r) => r === role).length,
            })),
            winConditions: [WinCondition.SlaughterCity],
            selfDestruct: { enabledWindows: [] },
          },
          game = bootstrapGame(config, { fixedRoles: roles, locale });
        let fallbacks = 0,
          nativeCalls = 0,
          decisions = 0,
          closedSessions = 0;
        const privilegedFallbackProvider = {
          async getAction() {
            fallbacks++;
            return { name: "choose_exemplar" as const, args: { target_id: 2 } };
          },
        };
        const server =
          transport === "sdk"
            ? Bun.serve({
                hostname: "127.0.0.1",
                port: 0,
                async fetch(input) {
                  const body = (await input.json()) as any;
                  nativeCalls++;
                  if (locale === "en")
                    expect(JSON.stringify(body.messages)).not.toMatch(/[\u4e00-\u9fff]/);
                  if (failure === "transport")
                    return Response.json(
                      { error: { message: "synthetic refusal" } },
                      { status: 401 },
                    );
                  return Response.json({
                    id: "hybrid-empty",
                    object: "chat.completion",
                    created: 1,
                    model: "synthetic",
                    choices: [
                      {
                        index: 0,
                        finish_reason: "stop",
                        message: { role: "assistant", content: "No action" },
                      },
                    ],
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
                  });
                },
              })
            : undefined;
        const provider =
          transport === "sdk"
            ? new LlmActionProvider(
                game.world,
                new AiSdkClient({
                  apiKey: "synthetic-only",
                  baseURL: `${server!.url.origin}/v1`,
                  model: "synthetic",
                }),
                { boardConfig: config, privilegedFallbackProvider, llmTimeoutMs: 2000 },
              )
            : new AcpActionProvider(game.world, {
                boardConfig: config,
                privilegedFallbackProvider,
                turnTimeoutMs: 2000,
                sessionFactory: {
                  async createSession() {
                    if (failure === "transport") {
                      nativeCalls++;
                      throw new Error("synthetic session failure");
                    }
                    return {
                      sessionId: "hybrid-empty",
                      async prompt(content) {
                        if (content.includes("[Action prompt]") || content.includes("[行动提示]"))
                          nativeCalls++;
                      },
                      async cancel() {},
                      async close() {
                        closedSessions++;
                      },
                    };
                  },
                },
              });
        const manager = await SessionRecordManager.create(
          {
            sessionId: "hybrid-failed-choice",
            board: "synthetic-hybrid",
            locale,
            startedAtIso: "2026-10-09T00:00:00.000Z",
          },
          await createTestTempDirectory("awa-hybrid-required-"),
        );
        try {
          await runWithSessionRecorder(manager, async () => {
            const reproduction = beginGameReproduction(manager, game, {
              engine: await currentEngineVersion(),
              boardId: "hybrid_fault",
              ...(void config, {}),
              locale,
              maxDays: 8,
            });
            let cycleFailure: unknown;
            await expect(
              game.phaseManager
                .runSingleCycle({
                  async getAction(request) {
                    decisions++;
                    expect(request.allowedTools).toEqual(["choose_exemplar"]);
                    expect(request.context.allow_fallback).toBe(false);
                    expect(request.context.retry_attempt ?? 0).toBe(decisions - 1);
                    expect(
                      await new BaselineBotActionProvider(game.world).getAction(request),
                    ).toBeNull();
                    return reproduction.decide(request, provider);
                  },
                })
                .catch((error) => {
                  cycleFailure = error;
                  throw error;
                }),
            ).rejects.toThrow("hybrid_valid_action_missing");
            expect(decisions).toBe(3);
            expect(nativeCalls).toBeGreaterThanOrEqual(3);
            expect(fallbacks).toBe(0);
            expect(
              getHybridState(game.world.getComponent(1, COMPONENT.Role)!),
            ).toEqual({ remaining: 1, choice: null });
            expect(
              game.world.getComponent(1, COMPONENT.Victory)!.affiliations,
            ).toEqual([]);
            expect(game.phaseManager.getEvents().some((e) => e.type.startsWith("hybrid_"))).toBe(
              false,
            );
            expect(game.phaseManager.getSnapshot().gameOver).toBe(false);
            expect(game.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
            reproduction.checkpoint(
              captureCheckpoint(
                game.world,
                game.phaseManager.getSnapshot(),
                1,
                false,
                game.phaseManager.getEvents().length,
                cycleFailure,
              ),
              game.phaseManager.getEvents(),
            );
            manager.noteReproductionFailure("cycle", cycleFailure);
            await manager.finalize({
              endedAtIso: "2026-10-09T00:01:00.000Z",
              winner: null,
              finishReason: "runtime_error",
              players: [],
            });
          });
          const view = readReplayPlayerView(JSON.parse(
            await readFile(path.join(manager.sessionDir, "players/player_1.json"), "utf8"),
          ));
          expect(view.timeline).toHaveLength(3);
          expect(view.timeline.every((row: any) => row.kind === "turn")).toBe(true);
          const messages = view.timeline.flatMap((row: any) => row.delta_messages);
          expect(
            messages.some(
              (message: any) => message.kind === "fallback" || message.kind === "tool_call",
            ),
          ).toBe(false);
          expect(
            messages
              .filter((message: any) => message.kind === "action_summary")
              .map((message: any) => JSON.parse(message.content)),
          ).toEqual(Array.from({ length: 3 }, () => ({ action_mode: "none", final_action: null })));
          const record = await readReproduction(path.join(manager.sessionDir, "reproduction.json")),
            replayRoot = await createTestTempDirectory("awa-hybrid-fault-replayed-");
          expect(
            record.decisions.map((decision) => decision.request.context.allow_fallback),
          ).toEqual([false, false, false]);
          expect(record.termination?.reason).toBe("runtime_error");
          expect((await replayReproduction(record, replayRoot)).snapshot).toEqual(
            game.phaseManager.getSnapshot(),
          );
          const altered = structuredClone(record);
          altered.decisions[0].request.context.allow_fallback = true;
          await expect(replayReproduction(altered, replayRoot)).rejects.toThrow(
            "reproduction_observation_mismatch",
          );
        } finally {
          await provider.close();
          server?.stop(true);
        }
        if (transport === "acp" && failure === "empty") expect(closedSessions).toBe(1);
      }, 10000);
