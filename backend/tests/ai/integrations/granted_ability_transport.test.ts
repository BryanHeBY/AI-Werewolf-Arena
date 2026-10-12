/**
 * Real agent transport integration verify bound granted inspection and exhausted Witch knife visibility.
 * Input: Factory agents, synthetic model/child scripts and explicit granted/native ability state.
 * Output and independent oracle: Literal source-bound actions, unknown exhausted-antidote knife prompt and unchanged identity; test-owned transports are closed.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { PotionType } from "../../../src/core";
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, Role, type GameEvent, type RoleComponent } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { grantNightAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { allNightAbilities } from "../../../src/game/mechanisms/roles/abilities";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { BaselineBotActionProvider } from "../../../src/ai/agents/providers/action_providers";
import { createPlayerAgentRuntime } from "../../../src/runtime/player_agent_factory";
import type { ResolvedAgentRuntimeProfile } from "../../../src/runtime/config/contracts";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["llm", "acp"] as const)
    test(`${locale}/${kind}: a Villager's granted inspection crosses the actual transport and is applied only to its bound instance`, async () => {
      const root = await createTestTempDirectory("awa-granted-transport-"),
        events: GameEvent[] = [],
        messages: any[] = [];
      const { world } = bootstrapGame(sixPlayerMvpConfig, {
        locale,
        fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
      });
      grantNightAbility(
        world,
        5,
        {
          id: "gift:transport",
          kind: "seer_check",
          state: { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] },
          source: { kind: "gift", actorId: 3 },
          startsOnDay: 1,
          maxUses: 1,
        },
        events,
      );
      const planFile = path.join(root, "plan.json");
      await writeFile(
        planFile,
        JSON.stringify({
          actorId: 5,
          role: "villager",
          locale,
          turns: [
            { day: 1, stage: "seer", action: { name: "check_identity", args: { target_id: 1 } } },
          ],
        }),
      );
      const server =
        kind === "llm"
          ? Bun.serve({
              hostname: "127.0.0.1",
              port: 0,
              async fetch(request) {
                const body = (await request.json()) as any;
                messages.push(...body.messages);
                expect(body.messages.at(-1).content).toContain("gift:transport");
                const turn = /turn_id (?:must be|必须为) (t\d+)/.exec(
                  body.messages.at(-1).content,
                )![1];
                return Response.json({
                  id: "granted",
                  object: "chat.completion",
                  created: 1,
                  model: "synthetic",
                  choices: [
                    {
                      index: 0,
                      finish_reason: "tool_calls",
                      message: {
                        role: "assistant",
                        content: null,
                        tool_calls: [
                          {
                            id: "call",
                            type: "function",
                            function: {
                              name: "submit_action",
                              arguments: JSON.stringify({
                                turn_id: turn,
                                action: "check_identity",
                                arguments: { target_id: 1 },
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
            })
          : undefined;
      const profile: ResolvedAgentRuntimeProfile =
        kind === "llm"
          ? {
              name: "synthetic",
              providerName: "synthetic",
              kind,
              model: "synthetic",
              provider: {
                type: "openai",
                apiKey: "synthetic-only",
                baseURL: `${server!.url.origin}/v1`,
              },
            }
          : {
              name: "synthetic",
              providerName: "synthetic",
              kind,
              provider: {
                type: "acp",
                sessionConfigOptions: {},
                transport: "stdio",
                command: process.execPath,
                env: {},
                args: [path.resolve(process.cwd(), "tests/fixtures/acp_game_agent.ts"), planFile],
              },
            };
      const workspace = path.join(root, "workspace");
      const runtime = await createPlayerAgentRuntime({
        world,
        boardConfig: sixPlayerMvpConfig,
        profilesByActor: new Map([[5, profile]]),
        acpWorkspaceRoot: workspace,
        llmTimeoutMs: 3000,
        printLlmIo: false,
        printThinking: false,
        trace: false,
        displayLocale: locale,
        colorizeLogs: false,
      });
      try {
        const pipeline = new NightPipeline({
          world,
          events,
          toolGateway: new ToolGateway(),
          damageResolutionSystem: new DamageResolutionSystem(),
        });
        await pipeline.execute(
          sixPlayerMvpConfig,
          {
            getAction: (request) =>
              request.actorId === 5
                ? runtime.provider.getAction(request)
                : new BaselineBotActionProvider(world).getAction(request),
          },
          1,
        );
        const ability = allNightAbilities(world.getComponent<RoleComponent>(5, COMPONENT.Role)!)[0];
        expect(ability.uses).toBe(1);
        expect(ability.lastUsedDay).toBe(1);
        expect(
          events
            .filter((event) => event.type === "seer_checked" && event.payload.actorId === 5)
            .map((event) => event.payload),
        ).toEqual([
          {
            actorId: 5,
            abilityId: "gift:transport",
            targetId: 1,
            isWerewolf: true,
            result: { kind: "camp", camp: "wolf" },
          },
        ]);
        expect(world.getComponent<RoleComponent>(5, COMPONENT.Role)!).toMatchObject({
          role: Role.Villager,
          camp: Camp.Good,
        });
        await runtime.close();
        if (kind === "llm") {
          const visible = messages
            .filter(
              (message) =>
                typeof message.content === "string" && message.content.startsWith('{"event":'),
            )
            .map((message) => JSON.parse(message.content).event);
          expect(visible.find(([, type]: any) => type === "ability_changed")[2].source).toEqual({
            kind: "gift",
          });
        } else {
          const facts = JSON.parse(
            await readFile(path.join(workspace, "player-5", "game-fixture.json"), "utf8"),
          );
          expect(facts.failure).toBe("");
          expect(facts.consumed).toBe(1);
          expect(facts.submitted).toBe(1);
          expect(facts.prompts.at(-1)).toContain("gift:transport");
          for (const pid of [facts.agentPid, facts.mcpPid]) {
            expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
            let failure: NodeJS.ErrnoException | undefined;
            try {
              process.kill(pid, 0);
            } catch (error) {
              failure = error as NodeJS.ErrnoException;
            }
            expect(failure?.code).toBe("ESRCH");
          }
        }
      } finally {
        await runtime.close();
        server?.stop(true);
      }
    }, 15000);

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["llm", "acp"] as const)
    test(`${locale}/${kind}: the actual Witch agent receives an unknown current knife after its antidote is exhausted`, async () => {
      const { getWitchState } = await import("../../../src/game/mechanisms/roles/private_state");
      const { text } = await import("@ai-werewolf-arena/game-text");
      const { twelvePlayerStandardConfig } =
        await import("../../../src/runtime/scenarios/twelve_player_standard");
      const root = await createTestTempDirectory("awa-exhausted-transport-"),
        events: GameEvent[] = [],
        prompts: string[] = [];
      const { world } = bootstrapGame(twelvePlayerStandardConfig, {
        locale,
        fixedRoles: [
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Seer,
          Role.Witch,
          Role.Hunter,
          Role.Idiot,
          Role.Villager,
          Role.Villager,
          Role.Villager,
          Role.Villager,
        ],
      });
      getWitchState(world.getComponent<RoleComponent>(6, COMPONENT.Role)!)!.heal = 0;
      const planFile = path.join(root, "plan.json");
      await writeFile(
        planFile,
        JSON.stringify({
          actorId: 6,
          role: "witch",
          locale,
          turns: [
            {
              day: 1,
              stage: "witch",
              action: { name: "use_potion", args: { target_id: 6, potion_type: PotionType.None } },
            },
          ],
        }),
      );
      const server =
        kind === "llm"
          ? Bun.serve({
              hostname: "127.0.0.1",
              port: 0,
              async fetch(request) {
                const body = (await request.json()) as any;
                prompts.push(body.messages.at(-1).content);
                const turn = /turn_id (?:must be|必须为) (t\d+)/.exec(
                  body.messages.at(-1).content,
                )![1];
                return Response.json({
                  id: "exhausted",
                  object: "chat.completion",
                  created: 1,
                  model: "synthetic",
                  choices: [
                    {
                      index: 0,
                      finish_reason: "tool_calls",
                      message: {
                        role: "assistant",
                        content: null,
                        tool_calls: [
                          {
                            id: "call",
                            type: "function",
                            function: {
                              name: "submit_action",
                              arguments: JSON.stringify({
                                turn_id: turn,
                                action: "use_potion",
                                arguments: { target_id: 6, potion_type: PotionType.None },
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
            })
          : undefined;
      const profile: ResolvedAgentRuntimeProfile =
        kind === "llm"
          ? {
              name: "synthetic",
              providerName: "synthetic",
              kind,
              model: "synthetic",
              provider: {
                type: "openai",
                apiKey: "synthetic-only",
                baseURL: `${server!.url.origin}/v1`,
              },
            }
          : {
              name: "synthetic",
              providerName: "synthetic",
              kind,
              provider: {
                type: "acp",
                sessionConfigOptions: {},
                transport: "stdio",
                command: process.execPath,
                env: {},
                args: [path.resolve(process.cwd(), "tests/fixtures/acp_game_agent.ts"), planFile],
              },
            };
      const workspace = path.join(root, "workspace"),
        runtime = await createPlayerAgentRuntime({
          world,
          boardConfig: twelvePlayerStandardConfig,
          profilesByActor: new Map([[6, profile]]),
          acpWorkspaceRoot: workspace,
          llmTimeoutMs: 3000,
          trace: false,
          printLlmIo: false,
          printThinking: false,
          displayLocale: locale,
          colorizeLogs: false,
        });
      try {
        await new NightPipeline({
          world,
          events,
          toolGateway: new ToolGateway(),
          damageResolutionSystem: new DamageResolutionSystem(),
        }).execute(
          twelvePlayerStandardConfig,
          {
            async getAction(request) {
              if (request.context.stage === "wolf_vote")
                return { name: "kill_vote", args: { target_id: 10, abstain: false } };
              if (request.actorId === 6) {
                expect(Object.hasOwn(request.context, "wolf_target")).toBe(false);
                return runtime.provider.getAction(request);
              }
              return new BaselineBotActionProvider(world).getAction(request);
            },
          },
          1,
        );
        await runtime.close();
        if (kind === "acp") {
          const facts = JSON.parse(
            await readFile(path.join(workspace, "player-6", "game-fixture.json"), "utf8"),
          );
          prompts.push(facts.prompts.at(-1));
          expect(facts.failure).toBe("");
          expect(facts.submitted).toBe(1);
          for (const pid of [facts.agentPid, facts.mcpPid]) {
            expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
            let failure: NodeJS.ErrnoException | undefined;
            try {
              process.kill(pid, 0);
            } catch (error) {
              failure = error as NodeJS.ErrnoException;
            }
            expect(failure?.code).toBe("ESRCH");
          }
        }
        expect(prompts).toHaveLength(1);
        expect(prompts[0]).toContain(text(locale, "prompt.stage.unknown_wolf_target"));
        expect(prompts[0]).not.toContain(text(locale, "prompt.stage.wolf_target", { target: 10 }));
        expect(getWitchState(world.getComponent<RoleComponent>(6, COMPONENT.Role)!)!.poison).toBe(
          1,
        );
      } finally {
        await runtime.close();
        server?.stop(true);
      }
    }, 15000);
