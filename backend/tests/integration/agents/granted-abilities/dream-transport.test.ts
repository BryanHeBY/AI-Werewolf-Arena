/**
 * 集成测试：负责原平民受赠摄梦能力通过真实 SDK／ACP 工厂传输的接线验证。
 * 输入为独立字面提示、回执、原生身份及临时文件中的适配进程数据；输出沿用原断言核对绑定实例。
 * 录制／传输只做本地装配，不调用计费模型，不由生产输出生成期望结果。
 */
import { acpAdapterEntry } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role, Phase, type ActionRequest } from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { grantNightAbility } from "../../../../src/game/mechanisms/roles/night-ability-grants";
import { createPlayerAgentRuntime } from "../../../../src/runtime/player_agent_factory";
import type { ResolvedAgentRuntimeProfile } from "../../../../src/runtime/config/contracts";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { type ActorTransportPlan } from "../../../support/transport/contracts";
for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["llm", "acp"] as const)
    test(`${locale}/${kind}: actual factory transport gives a gifted Villager full dream rules while retaining identity and read-only receipt`, async () => {
      const root = await createTestTempDirectory("awa-gift-dream-"),
        game = bootstrapGame(sixPlayerMvpConfig, {
          fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
          locale,
          playerNames: { "5": "Seat 5" },
        });
      const ability = grantNightAbility(
        game.world,
        5,
        {
          id: "gift:day-dream",
          kind: "dream",
          state: { lastTarget: 6, lastDay: 1, history: [{ day: 1, targetId: 6 }] },
          source: { kind: "gift", actorId: 3 },
          startsOnDay: 2,
          maxUses: 2,
        },
        [],
      );
      const plan: ActorTransportPlan = {
        actorId: 5,
        role: Role.Villager,
        locale,
        expectedName: "Seat 5",
        expectedIdentityMarker:
          locale === "en" ? "your true role is Villager." : "真实身份是平民。",
        requiredCurrentMarkers: [
          locale === "en" ? "Dream ability rules for this turn:" : "本轮梦能力规则：",
          '"lastTarget":6',
          '"lastDay":1',
        ],
        forbiddenCurrentMarkers: [
          locale === "en" ? "Your role is Dreamer" : "你的底牌是【摄梦人】",
        ],
        turns: [{ day: 2, stage: "dreamer", action: { name: "dream", args: { target_id: 6 } } }],
      };
      const script = path.join(root, "plan.json");
      await writeFile(script, JSON.stringify(plan));
      let seen = 0;
      const server =
        kind === "llm"
          ? Bun.serve({
              hostname: "127.0.0.1",
              port: 0,
              async fetch(input) {
                const body = (await input.json()) as any;
                const text = JSON.stringify(body.messages);
                for (const marker of plan.requiredCurrentMarkers!)
                  expect(text.replaceAll('\\"', '"')).toContain(marker);
                expect(text).not.toContain(plan.forbiddenCurrentMarkers![0]);
                expect(body.messages[0].content).toContain(plan.expectedIdentityMarker!);
                seen++;
                return Response.json({
                  id: "synthetic-dream-gift",
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
                            id: "c1",
                            type: "function",
                            function: {
                              name: "submit_action",
                              arguments: JSON.stringify({
                                turn_id: "t1",
                                action: "dream",
                                arguments: { target_id: 6 },
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
        const request: ActionRequest = {
          actorId: 5,
          phase: Phase.Night,
          allowedTools: ["dream"],
          context: {
            day: 2,
            stage: "dreamer",
            ability_id: ability.id,
            visible_events: [],
            turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
          },
        };
        expect(await runtime.provider.getAction(request)).toEqual({
          name: "dream",
          args: { target_id: 6 },
        });
        expect(ability.uses).toBe(0);
        expect(ability.state.lastDay).toBe(1);
        if (kind === "llm") expect(seen).toBe(1);
      } finally {
        await runtime.close();
        server?.stop(true);
      }
      if (kind === "acp") {
        const trace = JSON.parse(
          await readFile(path.join(root, "player-5/game-fixture.json"), "utf8"),
        );
        expect(trace.failure).toBe("");
        expect(trace.consumed).toBe(1);
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
