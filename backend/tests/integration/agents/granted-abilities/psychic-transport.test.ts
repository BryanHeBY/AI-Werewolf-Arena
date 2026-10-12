/**
 * Integration tests: Exercises actual SDK/ACP factory transports for granted Psychic
 * inspection policies. Literal per-instance prompts and receipts check original Villager
 * identity and independent copied policy without prompt contamination. Existing literal
 * expectations and independently supplied fixture plans remain the oracle;
 * transport/recording setup is local and no billed model session is started.
 */
import { acpAdapterEntry } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role, Phase, type ActionRequest } from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { grantNightAbility } from "../../../../src/game/mechanisms/roles/ability_changes";
import { createPlayerAgentRuntime } from "../../../../src/runtime/player_agent_factory";
import type { ResolvedAgentRuntimeProfile } from "../../../../src/runtime/config/contracts";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import type { ActorTransportPlan } from "../../../support/foundation_transport_plan";
import { assertTransportPrompt } from "../../../support/transport_prompt_oracle";
for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["llm", "acp"] as const)
    test(`${locale}/${kind}: a real gifted Villager uses each bound inspection policy without identity or prompt contamination`, async () => {
      const root = await createTestTempDirectory("awa-dual-role-check-"),
        game = bootstrapGame(sixPlayerMvpConfig, {
          fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
          locale,
          playerNames: { "5": "Seat 5" },
        });
      const state = {
          lastTarget: 6,
          lastDay: 1,
          history: [{ day: 1, targetId: 6, result: { kind: "role" as const, role: Role.Wolf } }],
        },
        early = grantNightAbility(
          game.world,
          5,
          {
            id: "gift:early-transport",
            kind: "role_check",
            state,
            source: { kind: "gift", actorId: 3 },
            startsOnDay: 2,
            maxUses: 2,
          },
          [],
        ),
        late = grantNightAbility(
          game.world,
          5,
          {
            id: "gift:late-transport",
            kind: "role_check",
            state: { ...state, policy: "psychic" },
            source: { kind: "gift", actorId: 3 },
            startsOnDay: 2,
            maxUses: 2,
          },
          [],
        );
      const gargRule =
          locale === "en" ? "Role inspection ability for this turn:" : "本轮具体角色查验能力：",
        psychicRule =
          locale === "en" ? "Spirit Seer inspection ability for this turn:" : "本轮通灵查验能力：";
      const plan: ActorTransportPlan = {
        actorId: 5,
        role: Role.Villager,
        locale,
        expectedName: "Seat 5",
        expectedIdentityMarker:
          locale === "en" ? "your true role is Villager." : "真实身份是平民。",
        forbiddenCurrentMarkers: [
          locale === "en" ? "Your role is Spirit Seer" : "你的底牌是【通灵师】",
          locale === "en" ? "Your role is Gargoyle" : "你的底牌是【石像鬼】",
        ],
        turns: [
          {
            day: 2,
            stage: "role_inspection",
            action: { name: "inspect_role", args: { target_id: 4 } },
            requiredPromptMarkers: [gargRule],
            forbiddenPromptMarkers: [psychicRule],
            invalidActions: [{ name: "inspect_role", args: { target_id: 6 } }],
            expectedInvalidError: "role_inspection_repeat",
          },
          {
            day: 2,
            stage: "psychic",
            action: { name: "inspect_role", args: { target_id: 6 } },
            requiredPromptMarkers: [psychicRule],
            forbiddenPromptMarkers: [gargRule],
          },
        ],
      };
      const script = path.join(root, "plan.json");
      await writeFile(script, JSON.stringify(plan));
      let calls = 0;
      const server =
        kind === "llm"
          ? Bun.serve({
              hostname: "127.0.0.1",
              port: 0,
              async fetch(input) {
                const body = (await input.json()) as any,
                  index = calls < 2 ? 0 : 1,
                  prompt = [...body.messages]
                    .reverse()
                    .find(
                      (m: any) =>
                        m.role === "user" &&
                        typeof m.content === "string" &&
                        m.content.includes(locale === "en" ? "[Action prompt]" : "[行动提示]"),
                    )!.content,
                  turnId = assertTransportPrompt(plan, plan.turns[index], prompt);
                expect(body.messages[0].content).toContain(plan.expectedIdentityMarker!);
                calls++;
                const target_id = calls === 1 ? 6 : calls === 2 ? 4 : 6;
                return Response.json({
                  id: "synthetic-dual-inspection",
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
                            id: `c${calls}`,
                            type: "function",
                            function: {
                              name: "submit_action",
                              arguments: JSON.stringify({
                                turn_id: turnId,
                                action: "inspect_role",
                                arguments: { target_id },
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
              kind: "llm",
              providerName: "synthetic",
              provider: {
                type: "openai",
                apiKey: "synthetic-only",
                baseURL: `${server!.url.origin}/v1`,
              },
              model: "synthetic",
            }
          : {
              name: "synthetic",
              kind: "acp",
              providerName: "synthetic",
              provider: {
                type: "acp",
                transport: "stdio",
                command: process.execPath,
                env: {},
                args: [acpAdapterEntry("game"), script],
                sessionConfigOptions: {},
              },
            };
      const runtime = await createPlayerAgentRuntime({
        world: game.world,
        boardConfig: sixPlayerMvpConfig,
        profilesByActor: new Map([[5, profile]]),
        acpWorkspaceRoot: root,
        llmTimeoutMs: 10000,
        trace: false,
        colorizeLogs: false,
        printLlmIo: false,
        printThinking: false,
      });
      try {
        for (const [index, ability] of [early, late].entries()) {
          const request: ActionRequest = {
            actorId: 5,
            phase: Phase.Night,
            allowedTools: ["inspect_role"],
            context: {
              day: 2,
              stage: index === 0 ? "role_inspection" : "psychic",
              ability_id: ability.id,
              visible_events: [],
              turn_constraints: { min_valid_actions: index === 0 ? 1 : 0, max_valid_actions: 1 },
            },
          };
          expect(await runtime.provider.getAction(request)).toEqual(plan.turns[index].action);
          expect(ability.uses).toBe(0);
          expect(ability.lastUsedDay).toBeNull();
          expect(ability.state.lastDay).toBe(1);
        }
        if (kind === "llm") expect(calls).toBe(3);
      } finally {
        await runtime.close();
        server?.stop(true);
      }
      if (kind === "acp") {
        const trace = JSON.parse(
          await readFile(path.join(root, "player-5/game-fixture.json"), "utf8"),
        );
        expect(trace.failure).toBe("");
        expect(trace.consumed).toBe(2);
        expect(trace.rejected).toBe(1);
        for (const pid of [trace.agentPid, trace.mcpPid]) {
          expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
          try {
            process.kill(pid, 0);
            throw new Error("fixture_process_alive");
          } catch (error) {
            expect((error as NodeJS.ErrnoException).code).toBe("ESRCH");
          }
        }
      }
    }, 30000);
