/**
 * 场景测试验证 setup-reentry-and-failure-replay 的原请求、已付行动与失败记录链。输入保留原固定角色、动作脚本、故障与归档矩阵；原字面结果及检查点作为预期。显式特权回退仅服务该控制驱动，不将生产对局输出称作独立玩法 oracle。
 */
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
import { expect, spyOn, test } from "bun:test";
import { shapeshifterScenario } from "../../../support/features/shapeshifter/builders/scenario";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role, Phase, COMPONENT, PotionType, type BoardConfig, type RoleComponent, type ActionRequest, type ToolCall, type GameEvent } from "../../../../src/domain";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";

const deal = [
  Role.Shapeshifter,
  Role.Wolf,
  Role.Wolf,
  Role.Witch,
  Role.Hunter,
  Role.Villager,
  Role.Seer,
  Role.Villager,
];

function fixture(cards = deal, extra: Partial<BoardConfig> = {}) {
  const roles = [...cards];
  for (let i = 0; i < 2; i++) {
    const index = roles.indexOf(Role.Villager);
    if (index < 0) throw new Error("fixture_missing_extra_villagers");
    roles.splice(index, 1);
  }
  const config = { ...foxBoard(roles), ...extra };
  return { ...bootstrapGame(config, { fixedRoles: cards }), config, events: [] as GameEvent[] };
}

type Fixture = ReturnType<typeof fixture>;

const choose = (slot: 0 | 1): ToolCall => ({ name: "choose_shapeshifter_card", args: { slot } });

const actor = (g: Fixture) => g.world.getComponent(1, COMPONENT.Role)!;

test("first PM cycle enables chosen Wolf before pack chat, rejects ordinary-night reentry and never judges initial zero wolves", async () => {
  const g = fixture([
    Role.Shapeshifter,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Villager,
    Role.Villager,
    Role.Wolf,
    Role.Wolf,
  ]);
  const seen: ActionRequest[] = [];
  const snapshot = await g.phaseManager.runSingleCycle({
    async getAction(r) {
      seen.push(r);
      if (r.context.stage === "shapeshifter") return choose(1);
      if (r.allowedTools.includes("speak_to_wolves")) {
        expect(actor(g).role).toBe(Role.Wolf);
        await expect(
          g.phaseManager.runSingleCycle({
            async getAction() {
              return null;
            },
          }),
        ).rejects.toThrow("shapeshifter_setup_reentry");
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      }
      if (r.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: null, abstain: true } };
      if (r.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: 1 } };
      if (r.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: r.actorId, potion_type: PotionType.None } };
      if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
      if (r.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: null, abstain: true } };
      throw new Error(`unexpected:${r.context.stage}`);
    },
  });
  expect(seen[0]?.context.stage).toBe("shapeshifter");
  expect(seen.filter((r) => r.context.stage === "shapeshifter")).toHaveLength(1);
  expect(snapshot).toMatchObject({ day: 2, phase: Phase.Voting, gameOver: false });
});

test("real Day/Voting recursive PM is rejected before phase/event mutation; later actual night never reopens choice", async () => {
  const scenario = shapeshifterScenario("seer"),
    g = bootstrapGame(scenario.board.config, { fixedRoles: scenario.initialDeal }),
    queues = new Map([...scenario.turns].map(([id, turns]) => [id, [...turns]]));
  let blocked = 0;
  const snapshot = await g.phaseManager.runUntilGameOver(
    {
      async getAction(r) {
        const next = queues.get(r.actorId)!.shift()!;
        expect(next.stage).toBe(r.context.stage);
        expect(next.day).toBe(r.context.day);
        if (["day_speech", "voting"].includes(r.context.stage)) {
          const before = g.phaseManager.getSnapshot(),
            length = g.phaseManager.getEvents().length;
          await expect(
            g.phaseManager.runSingleCycle({
              async getAction() {
                throw new Error("unexpected_reentrant_request");
              },
            }),
          ).rejects.toThrow("shapeshifter_cycle_reentry_after_night");
          expect(g.phaseManager.getSnapshot()).toEqual(before);
          expect(g.phaseManager.getEvents()).toHaveLength(length);
          blocked++;
        }
        return next.action;
      },
    },
    10,
  );
  expect(snapshot.gameOver).toBe(true);
  expect(blocked).toBeGreaterThan(0);
  expect([...queues.values()].every((q) => q.length === 0)).toBe(true);
  expect(
    g.phaseManager.getEvents().filter((e) => e.type === "shapeshifter_identity_chosen"),
  ).toHaveLength(1);
});

for (const transport of ["sdk", "acp"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const failure of ["invalid", "missing"] as const)
      test(`${transport}/${locale}/${failure}: real strict provider failure closes Shapeshifter without fallback or card swap, exact partial Tape`, async () => {
        const scenario = shapeshifterScenario("both0", 6, locale),
          root = await createTestTempDirectory("awa-shapeshifter-failure-"),
          output = await createTestTempDirectory("awa-shapeshifter-failure-replay-");
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
            const privilegedFallbackProvider = {
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
                          action: "choose_shapeshifter_card",
                          arguments: { slot: 2 },
                        },
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
                          sessionId: "shapeshifter-failure",
                          async prompt() {
                            if (failure === "invalid")
                              for (let i = 0; i < 3; i++)
                                input.registry.submitAction("shapeshifter-failure", {
                                  turn_id: "t1",
                                  action: "choose_shapeshifter_card",
                                  arguments: { slot: 2 },
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
                  if (r.context.stage !== "shapeshifter") {
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
            decision = record.decisions.find((d) => d.stage === "shapeshifter")!;
          expect(decision.request.context.turn_constraints.min_valid_actions).toBe(1);
          expect(decision.request.context.allow_fallback).toBe(false);
          expect(decision.outcome).toMatchObject({ kind: "error", code: "decision_failed" });
          expect(record.checkpoints.at(-1)!.complete).toBe(false);
          expect(record.checkpoints.at(-1)!.shapeshifterSetup).toMatchObject({
            status: "failed",
            selection: null,
          });
          expect(record.checkpoints.at(-1)!.shapeshifterSetup!.hands).toEqual(
            record.checkpoints[0]!.shapeshifterSetup!.hands,
          );
          expect(record.checkpoints.at(-1)!.shapeshifterSetup!.reserve).toEqual(
            record.checkpoints[0]!.shapeshifterSetup!.reserve,
          );
          expect(record.events.some((e) => e.type === "shapeshifter_identity_chosen")).toBe(false);
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
