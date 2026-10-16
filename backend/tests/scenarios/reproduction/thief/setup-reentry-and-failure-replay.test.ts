/**
 * 场景测试验证 setup-reentry-and-failure-replay 的原请求、已付行动与失败记录链。输入保留原固定角色、动作脚本、故障与归档矩阵；原字面结果及检查点作为预期。显式特权回退仅服务该控制驱动，不将生产对局输出称作独立玩法 oracle。
 */
import { runtimeConfigV2 } from "../../../support/builders/runtime-config-v2";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as runtimeFactory from "../../../../src/app/player-agent-factory";
import { LlmActionProvider } from "../../../../src/agents/llm/llm-action-provider";
import { AcpActionProvider } from "../../../../src/agents/acp/acp-action-provider";
import { parseRuntimeConfig } from "../../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../../src/app/config/resolve-game-setup";
import { runGame } from "../../../../src/app/game-runner";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { expect, spyOn, test } from "bun:test";
import { thiefScenario } from "../../../support/features/thief/builders/scenario";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Phase,
  COMPONENT,
  PotionType,
  type BoardConfig,
  type RoleComponent,
  type ActionRequest,
  type ToolCall,
  type GameEvent,
} from "../../../../src/domain";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";

const deal = [
  Role.Thief,
  Role.Wolf,
  Role.Witch,
  Role.Hunter,
  Role.Villager,
  Role.Villager,
  Role.Wolf,
  Role.Seer,
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

const choose = (slot: 0 | 1): ToolCall => ({ name: "choose_thief_card", args: { slot } });

const actor = (g: Fixture) => g.world.getComponent(1, COMPONENT.Role)!;

test("first PM cycle enables chosen Wolf before pack chat, rejects ordinary-night reentry and never judges initial zero wolves", async () => {
  const g = fixture([
    Role.Thief,
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
      if (r.context.stage === "thief") return choose(1);
      if (r.allowedTools.includes("speak_to_wolves")) {
        expect(actor(g).role).toBe(Role.Wolf);
        await expect(
          g.phaseManager.runSingleCycle({
            async getAction() {
              return null;
            },
          }),
        ).rejects.toThrow("thief_setup_reentry");
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
  expect(seen[0]?.context.stage).toBe("thief");
  expect(seen.filter((r) => r.context.stage === "thief")).toHaveLength(1);
  expect(snapshot).toMatchObject({ day: 2, phase: Phase.Voting, gameOver: false });
});

test("real Day/Voting recursive PM is rejected before phase/event mutation; later actual night never reopens choice", async () => {
  const scenario = thiefScenario("seer"),
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
          ).rejects.toThrow("thief_cycle_reentry_after_night");
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
  expect(g.phaseManager.getEvents().filter((e) => e.type === "thief_identity_chosen")).toHaveLength(
    1,
  );
});

for (const transport of ["sdk", "acp"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    for (const failure of ["invalid", "missing"] as const)
      test(`${transport}/${locale}/${failure}: real strict provider failure closes Thief without fallback or card swap, exact partial Tape`, async () => {
        const scenario = thiefScenario("both0", 6, locale),
          root = await createTestTempDirectory("awa-thief-failure-"),
          output = await createTestTempDirectory("awa-thief-failure-replay-");
        const runtime = parseRuntimeConfig(
          runtimeConfigV2({
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
          }),
        );
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
                          action: "choose_thief_card",
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
                          sessionId: "thief-failure",
                          async prompt() {
                            if (failure === "invalid")
                              for (let i = 0; i < 3; i++)
                                input.registry.submitAction("thief-failure", {
                                  turn_id: "t1",
                                  action: "choose_thief_card",
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
                  if (r.context.stage !== "thief") {
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
            decision = record.decisions.find((d) => d.stage === "thief")!;
          expect(decision.request.context.turn_constraints.min_valid_actions).toBe(1);
          expect(decision.request.context.allow_fallback).toBe(false);
          expect(decision.outcome).toMatchObject({ kind: "error", code: "decision_failed" });
          expect(record.checkpoints.at(-1)!.complete).toBe(false);
          expect(record.checkpoints.at(-1)!.thiefSetup).toMatchObject({
            status: "failed",
            selection: null,
          });
          expect(record.checkpoints.at(-1)!.thiefSetup!.hands).toEqual(
            record.checkpoints[0]!.thiefSetup!.hands,
          );
          expect(record.checkpoints.at(-1)!.thiefSetup!.reserve).toEqual(
            record.checkpoints[0]!.thiefSetup!.reserve,
          );
          expect(record.events.some((e) => e.type === "thief_identity_chosen")).toBe(false);
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
