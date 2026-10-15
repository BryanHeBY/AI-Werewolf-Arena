/**
 * 场景测试验证 strict-failure-replay 的原请求、已付行动与失败记录链。输入保留原固定角色、动作脚本、故障与归档矩阵；原字面结果及检查点作为预期。显式特权回退仅服务该控制驱动，不将生产对局输出称作独立玩法 oracle。
 */
import { readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { expect, spyOn, test } from "bun:test";
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../src/app/config/resolve-game-setup";
import { runGame } from "../../../src/app/game-runner";
import {
  readReproduction,
  replayReproduction,
} from "../../../src/app/simulation/replay-reproduction";
import * as factory from "../../../src/app/player-agent-factory";
import { BaselineBotActionProvider } from "../../../src/agents/baseline/privileged";
import { LlmActionProvider } from "../../../src/agents/llm/llm-action-provider";
import { AcpActionProvider } from "../../../src/agents/acp/acp-action-provider";
import { awakenedScenario } from "../../support/features/awakened-hidden-wolf/builders/scenario";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

for (const transport of ["sdk", "acp"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`${transport}/${locale}: strict failure retains request policy, rejection evidence and exact partial Tape`, async () => {
      const scenario = awakenedScenario("mirror"),
        root = await createTestTempDirectory("awa-strict-failure-"),
        output = await createTestTempDirectory("awa-strict-failure-replay-");
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
      let fallbackCalls = 0;
      const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(
        async (options) => {
          const baseline = new BaselineBotActionProvider(options.world),
            privilegedFallbackProvider = {
              async getAction() {
                fallbackCalls++;
                return null;
              },
            };
          const client: any = {
            async chat() {
              throw new Error("unexpected_chat");
            },
            async runToolLoop(_m: any, _t: any, callbacks: any) {
              for (let i = 0; i < 3; i++)
                await callbacks.onToolCall({
                  name: "submit_action",
                  args: { turn_id: "t1", action: "awakened_mimic", arguments: { target_id: 1 } },
                });
              return { finalAction: null, assistantText: "End" };
            },
          };
          const provider =
            transport === "sdk"
              ? new LlmActionProvider(options.world, client, {
                  boardConfig: options.boardConfig,
                  privilegedFallbackProvider,
                })
              : new AcpActionProvider(options.world, {
                  boardConfig: options.boardConfig,
                  privilegedFallbackProvider,
                  sessionFactory: {
                    async createSession(input) {
                      return {
                        sessionId: "failure-tape",
                        async prompt() {
                          for (let i = 0; i < 3; i++)
                            input.registry.submitAction("failure-tape", {
                              turn_id: "t1",
                              action: "awakened_mimic",
                              arguments: { target_id: 1 },
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
              getAction(request) {
                return request.actorId === 1 && request.context.stage === "awakened_mimic"
                  ? provider.getAction(request)
                  : baseline.getAction(request);
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
        const directory = path.join(
          root,
          (await readdir(root)).find((name) => name.startsWith("session_"))!,
        );
        const record = await readReproduction(path.join(directory, "reproduction.json")),
          failed = record.decisions.find((decision) => decision.stage === "awakened_mimic")!;
        expect(failed.request.context.action_failure_policy).toBe("error");
        expect(failed.outcome).toMatchObject({ kind: "error", code: "decision_failed" });
        expect(record.checkpoints.at(-1)!.complete).toBe(false);
        expect(
          record.events.some(
            (event) =>
              event.type === "awakened_mimic_skipped" || event.type === "awakened_mimicked",
          ),
        ).toBe(false);
        const privateState = record.checkpoints.at(-1)!.players.find((player) => player.id === 1)!
          .privateState.awakened_hidden_wolf as any;
        expect(privateState.learned).toBeNull();
        expect(privateState.mimicClosedDay).toBeNull();
        expect((await replayReproduction(record, output)).snapshot).toEqual(
          record.checkpoints.at(-1)!.snapshot,
        );
        const altered = structuredClone(record);
        delete altered.decisions.find((decision) => decision.stage === "awakened_mimic")!.request
          .context.action_failure_policy;
        await expect(replayReproduction(altered, output)).rejects.toThrow(
          "reproduction_observation_mismatch",
        );
        const view = readReplayPlayerView(JSON.parse(
          await readFile(path.join(directory, "players/player_1.json"), "utf8"),
        ));
        expect(
          view.timeline.some(
            (entry: any) =>
              entry.kind === "turn" &&
              entry.delta_messages.some((message: any) => message.kind === "constraint_warning"),
          ),
        ).toBe(true);
        expect(JSON.stringify(view)).toContain("turn_invalid_action_limit");
        expect(JSON.stringify(view)).not.toContain("transport_error");
      } finally {
        create.mockRestore();
      }
    }, 10000);
