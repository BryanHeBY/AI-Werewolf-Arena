/**
 * 集成测试验证行动接收在 SDK／MCP 的一致性。输入为原回执／权限矩阵、合成 SDK 回调或本机 HTTP／MCP；字面回执、引用／getter／错误轨迹、事实和状态为预期。真实 Bun 监听与 stdio sidecar 检验业务回执，一项原用例写临时录制。finally 关闭原传输和服务；不读取私有配置／认证或调用计费模型。
 */
import {
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../src/game/mechanisms/roles/role-catalog-assembly";

import { PotionType } from "../../../../src/core";
import { expect, test } from "bun:test";
import { text } from "@ai-werewolf-arena/game-text";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { AcpTurnRegistry } from "../../../../src/ai/integrations/acp/acp_turn_registry";
import { WerewolfMcpControlServer } from "../../../../src/ai/integrations/acp/werewolf_mcp_control";
import { AiSdkClient } from "../../../../src/ai/integrations/llm/ai_sdk_client";
import { SdkGameToolLoop } from "../../../../src/ai/agents/llm/sdk_game_tool_loop";
import { PlayerPromptSession } from "../../../../src/ai/agents/llm/player_prompt_session";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import { LlmObserver } from "../../../../src/ai/agents/player/player_observer";
import {
  getDefaultToolCallRepairRegistry,
  getDefaultToolSpecRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../../src/game/mechanisms";
import { twelvePlayerStandardConfig } from "../../../../src/runtime/scenarios/twelve_player_standard";
import {
  COMPONENT,
  Camp,
  DeathCause,
  Phase,
  Role,
  type ActionRequest,
  type RoleComponent,
} from "../../../../src/core";
import { getHunterState } from "../../../../src/game/mechanisms/roles/hunter/ports";
import { getWitchState } from "../../../../src/game/mechanisms/roles/witch/ports";
import type { ToolLoopStepTrace } from "../../../../src/ai/integrations/llm/transport";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

const roles = [
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
];

const request: ActionRequest = {
  actorId: 6,
  phase: Phase.Night,
  allowedTools: ["use_potion"],
  context: {
    day: 1,
    stage: "witch",
    wolf_target: 9,
    visible_events: [],
    turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
  },
};

function sdkLoop(
  world: ReturnType<typeof bootstrapGame>["world"],
  onTrace?: (trace: ToolLoopStepTrace[]) => void,
) {
  const policy = new PlayerPromptPolicy(world, {
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    roleCatalog: getDefaultRoleCatalog(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  });
  const observer = new LlmObserver({ trace: false, printLlmIo: false, printThinking: false });
  if (onTrace) observer.thinking = onTrace;
  return new SdkGameToolLoop(
    world,
    getDefaultToolCallRepairRegistry(),
    new PlayerPromptSession({ maxPromptEvents: 20, promptPolicy: policy }),
    observer,
  );
}

const submissions = [
  {
    turn_id: "t99",
    action: "use_potion",
    arguments: { target_id: 6, potion_type: PotionType.None },
  },
  { turn_id: "t1", action: "speak", arguments: { text: "wrong tool" } },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 9, potion_type: PotionType.Heal, private_override: "synthetic-secret" },
  },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 6, potion_type: PotionType.Heal },
  },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 9, potion_type: PotionType.Heal },
  },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 999, potion_type: PotionType.Poison },
  },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 6, potion_type: PotionType.None },
  },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 9, potion_type: PotionType.Poison },
  },
];

const staleReport = {
  turn_id: "t99",
  category: "state",
  severity: "high",
  message: "synthetic stale report",
};

const expectedCodes = [
  "turn_id_mismatch",
  "turn_id_mismatch",
  "tool_not_allowed_in_this_turn",
  "invalid_tool_arguments",
  "self_heal",
  "heal_unavailable",
  "poison_target",
  "accepted",
  "turn_not_open_or_session_invalid",
];

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: real SDK HTTP and injected MCP return identical business receipts; rejected calls remain open and preflight does not record domain operations`, async () => {
    const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
    const acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
    const sdkState = getWitchState(sdk.world.getComponent(6, COMPONENT.Role)!)!;
    const acpState = getWitchState(acp.world.getComponent(6, COMPONENT.Role)!)!;
    (sdkState as { heal: number }).heal = 0;
    (acpState as { heal: number }).heal = 0;
    const before = structuredClone(sdkState);
    let requests = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(input) {
        await input.json();
        requests++;
        const actionCalls = (requests === 1 ? submissions.slice(0, 6) : submissions.slice(6)).map(
          (args) => ({ name: "submit_action", args }),
        );
        const calls =
          requests === 1
            ? [{ name: "report_bug", args: staleReport }, ...actionCalls]
            : actionCalls;
        return Response.json({
          id: "synthetic-reception",
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
                tool_calls: calls.map(({ name, args }, index) => ({
                  id: `call-${requests}-${index}`,
                  type: "function",
                  function: { name, arguments: JSON.stringify(args) },
                })),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
    });
    const registry = new AcpTurnRegistry(acp.world),
      control = new WerewolfMcpControlServer(registry);
    const client = new Client({ name: "reception-test", version: "1.0.0" });
    const config = await control.start(process.execPath, [
      path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts"),
    ]);
    control.bindSession("same-session");
    const pending = registry.openTurn(request, "same-session");
    const record = await SessionRecordManager.create(
      {
        sessionId: `reception-${locale}`,
        board: "twelve_player_standard",
        locale,
        startedAtIso: new Date().toISOString(),
      },
      await createTestTempDirectory("awa-reception-"),
    );
    try {
      await client.connect(
        new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: Object.fromEntries(config.env.map((item) => [item.name, item.value])),
        }),
      );
      await runWithSessionRecorder(record, async () => {
        const receivedSdk: unknown[] = [];
        const loop = sdkLoop(sdk.world, (trace) =>
          receivedSdk.push(
            ...trace.flatMap((step) => step.toolCalls.map((call) => JSON.parse(call.toolResult))),
          ),
        );
        const result = await loop.run(
          new AiSdkClient({
            apiKey: "synthetic-only",
            baseURL: `${server.url.origin}/v1`,
            model: "synthetic",
          }),
          request,
          [{ role: "user", content: "Submit the current action." }],
          2000,
          "t1",
        );
        const receivedAcp = [
          (await client.callTool({ name: "report_bug", arguments: staleReport })).structuredContent,
        ];
        for (const args of submissions)
          receivedAcp.push(
            (await client.callTool({ name: "submit_action", arguments: args })).structuredContent,
          );
        expect(receivedSdk).toEqual(receivedAcp);
        expect(
          receivedAcp.map((receipt: any) => (receipt.ok ? "accepted" : receipt.error)),
        ).toEqual(expectedCodes);
        expect(receivedAcp[7]).toEqual({
          ok: true,
          accepted: true,
          applied: false,
          action: "use_potion",
        });
        expect(JSON.stringify(receivedAcp)).not.toContain("synthetic-secret");
        if (locale === "en") expect(JSON.stringify(receivedAcp)).not.toMatch(/\p{Script=Han}/u);
        expect(result.action).toEqual({
          name: "use_potion",
          args: { target_id: 6, potion_type: PotionType.None },
        });
        expect(await pending.action).toEqual(result.action);
        expect(sdkState).toEqual(before);
        expect(acpState).toEqual(before);
        expect(requests).toBe(2);
        expect(
          new ToolGateway().validateAndSanitize(sdk.world, 6, result.action!, {
            phase: Phase.Night,
          }).ok,
        ).toBe(true);
      });
      await record.flushNow();
      const ops = JSON.parse(
        await readFile(path.join(record.sessionDir, "logic_ops.json"), "utf8"),
      ).ops;
      expect(
        ops.filter((op: any) => op.scope === "gateway" && op.op === "validate_tool_call"),
      ).toHaveLength(1);
    } finally {
      registry.close();
      await client.close();
      await control.close({ force: true });
      server.stop(true);
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: real SDK and MCP enforce wolf chat/knife permissions and phases before accepting a correction`, async () => {
    const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
    const acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
    let calls: Array<{ turn_id: string; action: string; arguments: Record<string, unknown> }> = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(input) {
        await input.json();
        return Response.json({
          id: "wolf-permissions",
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
                tool_calls: calls.map((args, index) => ({
                  id: `call-${index}`,
                  type: "function",
                  function: { name: "submit_action", arguments: JSON.stringify(args) },
                })),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
    });
    const registry = new AcpTurnRegistry(acp.world),
      control = new WerewolfMcpControlServer(registry);
    const client = new Client({ name: "wolf-permission-test", version: "1.0.0" });
    const config = await control.start(process.execPath, [
      path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts"),
    ]);
    control.bindSession("wolf-permissions");
    const cases = [
      {
        actor: 9,
        phase: Phase.Night,
        action: "speak_to_wolves",
        args: { text: "unauthorized", end_chat: true },
        error: "wolf_chat_permission",
      },
      {
        actor: 9,
        phase: Phase.Night,
        action: "kill_vote",
        args: { target_id: 1, abstain: false },
        error: "wolf_kill_permission",
      },
      {
        actor: 1,
        phase: Phase.Day,
        action: "speak_to_wolves",
        args: { text: "wrong-phase", end_chat: true },
        error: "wolf_chat_phase",
      },
      {
        actor: 1,
        phase: Phase.Day,
        action: "kill_vote",
        args: { target_id: 9, abstain: false },
        error: "wolf_kill_phase",
      },
    ] as const;
    try {
      await client.connect(
        new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: Object.fromEntries(config.env.map((item) => [item.name, item.value])),
        }),
      );
      for (const item of cases) {
        // Deliberately overbroad engine input tests preflight's independent guard.
        const input: ActionRequest = {
          actorId: item.actor,
          phase: item.phase,
          allowedTools: [item.action, "speak"],
          context: {
            day: 1,
            stage: "day_speech",
            visible_events: [],
            turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
          },
        };
        const pending = registry.openTurn(input, "wolf-permissions");
        calls = [
          { turn_id: pending.turnId, action: item.action, arguments: item.args },
          { turn_id: pending.turnId, action: "speak", arguments: { text: "corrected" } },
        ];
        const receivedSdk: unknown[] = [];
        const result = await sdkLoop(sdk.world, (trace) =>
          receivedSdk.push(
            ...trace.flatMap((step) => step.toolCalls.map((call) => JSON.parse(call.toolResult))),
          ),
        ).run(
          new AiSdkClient({
            apiKey: "synthetic-only",
            baseURL: `${server.url.origin}/v1`,
            model: "synthetic",
          }),
          input,
          [{ role: "user", content: "Correct the rejected action." }],
          2000,
          pending.turnId,
        );
        const receivedAcp: unknown[] = [];
        for (const args of calls)
          receivedAcp.push(
            (await client.callTool({ name: "submit_action", arguments: args })).structuredContent,
          );
        expect(receivedSdk).toEqual(receivedAcp);
        expect(receivedAcp[0]).toMatchObject({ ok: false, error: item.error });
        expect(receivedAcp[1]).toEqual({
          ok: true,
          accepted: true,
          applied: false,
          action: "speak",
        });
        expect(await pending.action).toEqual({ name: "speak", args: { text: "corrected" } });
        expect(result.action).toEqual(await pending.action);
        if (locale === "en") expect(JSON.stringify(receivedAcp)).not.toMatch(/\p{Script=Han}/u);
        registry.closeTurn("wolf-permissions");
      }
    } finally {
      registry.close();
      await client.close();
      await control.close({ force: true });
      server.stop(true);
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  for (const action of ["speak_to_wolves", "kill_vote"] as const)
    test(`${locale}: SDK and ACP providers use the injected role catalog for prompts, reception and local fallback (${action})`, async () => {
      const { RoleCatalog } = await import("../../../../src/game/mechanisms/roles/catalog");
      const { LlmActionProvider } =
        await import("../../../../src/ai/agents/llm/llm_action_provider");
      const { AcpActionProvider } =
        await import("../../../../src/ai/agents/acp/acp_action_provider");
      const { BaselineBotActionProvider } =
        await import("../../../../src/ai/agents/providers/action_providers");
      const catalog = createRoleCatalog({
        contributions: getDefaultRoleContributions().map((profile) =>
          profile.metadata.role !== Role.Wolf
            ? profile
            : {
                ...profile,
                runtime: {
                  ...profile.runtime,
                  wolfTeam: {
                    recognizedByPack: false,
                    recognizes: "none" as const,
                    canChat: false,
                    canVoteForKill: false,
                  },
                },
              },
        ),
      });
      const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
      const acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
      const input: ActionRequest = {
        actorId: 1,
        phase: Phase.Night,
        allowedTools: [action, "speak"],
        context: {
          day: 1,
          stage: "wolf_discussion",
          visible_events: [],
          turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
        },
      };
      const badArgs =
        action === "kill_vote"
          ? { target_id: 9, abstain: false }
          : { text: "not-permitted", end_chat: true };
      const requests: any[] = [],
        receivedAcp: any[] = [];
      let acpInitialPrompt = "";
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(incoming) {
          requests.push(await incoming.json());
          const args =
            requests.length === 1
              ? { turn_id: "t1", action, arguments: badArgs }
              : { turn_id: "t1", action: "speak", arguments: { text: "corrected" } };
          return Response.json({
            id: "catalog",
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
                      id: `call-${requests.length}`,
                      type: "function",
                      function: { name: "submit_action", arguments: JSON.stringify(args) },
                    },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          });
        },
      });
      let control: WerewolfMcpControlServer | undefined, client: Client | undefined;
      const sdkProvider = new LlmActionProvider(
        sdk.world,
        new AiSdkClient({
          apiKey: "synthetic-only",
          baseURL: `${server.url.origin}/v1`,
          model: "synthetic",
        }),
        { roleCatalog: catalog, boardConfig: twelvePlayerStandardConfig, llmTimeoutMs: 2000 },
      );
      const acpProvider = new AcpActionProvider(acp.world, {
        roleCatalog: catalog,
        boardConfig: twelvePlayerStandardConfig,
        turnTimeoutMs: 2000,
        sessionFactory: {
          async createSession(sessionInput) {
            acpInitialPrompt = sessionInput.initialPrompt ?? "";
            control = new WerewolfMcpControlServer(sessionInput.registry);
            const config = await control.start(process.execPath, [
              path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts"),
            ]);
            control.bindSession("catalog-session");
            client = new Client({ name: "catalog-test", version: "1.0.0" });
            await client.connect(
              new StdioClientTransport({
                command: config.command,
                args: config.args,
                env: Object.fromEntries(config.env.map((item) => [item.name, item.value])),
              }),
            );
            return {
              sessionId: "catalog-session",
              async prompt(prompt) {
                const turn = /(?:Current turn ID: |当前回合 ID：)(t\d+)/.exec(prompt)![1];
                receivedAcp.push(
                  (
                    await client!.callTool({
                      name: "submit_action",
                      arguments: { turn_id: turn, action, arguments: badArgs },
                    })
                  ).structuredContent,
                );
                receivedAcp.push(
                  (
                    await client!.callTool({
                      name: "submit_action",
                      arguments: {
                        turn_id: turn,
                        action: "speak",
                        arguments: { text: "corrected" },
                      },
                    })
                  ).structuredContent,
                );
              },
              async cancel() {},
              async close() {
                await client!.close();
                await control!.close({ force: true });
              },
            };
          },
        },
      });
      try {
        expect(await sdkProvider.getAction(input)).toEqual({
          name: "speak",
          args: { text: "corrected" },
        });
        expect(await acpProvider.getAction(input)).toEqual({
          name: "speak",
          args: { text: "corrected" },
        });
        expect(requests).toHaveLength(2);
        const teammateHint = text(locale, "prompt.system.teammates", {
          teammates: text(locale, "common.none"),
        });
        expect(
          requests[0].messages.find((message: any) => message.role === "system").content,
        ).toContain(teammateHint);
        expect(acpInitialPrompt).toContain(teammateHint);
        const receipt = requests[1].messages
          .filter((message: any) => message.role === "tool")
          .map((message: any) => JSON.parse(message.content))[0];
        expect(receipt).toEqual(receivedAcp[0]);
        expect(receipt.error).toBe(
          action === "kill_vote" ? "wolf_kill_permission" : "wolf_chat_permission",
        );
        expect(receivedAcp[1]).toEqual({
          ok: true,
          accepted: true,
          applied: false,
          action: "speak",
        });
        expect(
          await new BaselineBotActionProvider(sdk.world, catalog).getAction({
            ...input,
            allowedTools: [action],
          }),
        ).toBeNull();
        await sdkProvider.close();
        await acpProvider.close();
        expect(sdkProvider.runtimeState.turns).toBe(0);
        expect(acpProvider.runtimeState.pool.sessions).toBe(0);
      } finally {
        await sdkProvider.close();
        await acpProvider.close();
        await client?.close();
        await control?.close({ force: true });
        server.stop(true);
      }
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: reused SDK and ACP sessions receive updated authorized teammate knowledge every turn`, async () => {
    const { RoleCatalog } = await import("../../../../src/game/mechanisms/roles/catalog");
    const { LlmActionProvider } = await import("../../../../src/ai/agents/llm/llm_action_provider");
    const { AcpActionProvider } = await import("../../../../src/ai/agents/acp/acp_action_provider");
    const catalog = createRoleCatalog({
      contributions: getDefaultRoleContributions().map((profile) =>
        profile.metadata.role !== Role.Seer
          ? profile
          : {
              ...profile,
              runtime: {
                ...profile.runtime,
                wolfTeam: (state: RoleComponent) => ({
                  recognizedByPack:
                    (state.privateState as { readonly revealed?: unknown }).revealed === true,
                  recognizes: "none" as const,
                  canChat: false,
                  canVoteForKill: false,
                }),
              },
            },
      ),
    });
    const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale }),
      acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
    sdk.world.getComponent(5, COMPONENT.Role)!.camp =
      acp.world.getComponent(5, COMPONENT.Role)!.camp = Camp.Wolf;
    const input: ActionRequest = {
      actorId: 1,
      phase: Phase.Day,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        visible_events: [],
        turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
      },
    };
    const requests: any[] = [],
      acpPrompts: string[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(incoming) {
        requests.push(await incoming.json());
        const turn = requests.length;
        return Response.json({
          id: "knowledge",
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
                    id: `call-${turn}`,
                    type: "function",
                    function: {
                      name: "submit_action",
                      arguments: JSON.stringify({
                        turn_id: `t${turn}`,
                        action: "speak",
                        arguments: { text: `turn-${turn}` },
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
    });
    let control: WerewolfMcpControlServer | undefined,
      client: Client | undefined,
      creations = 0;
    const sdkProvider = new LlmActionProvider(
      sdk.world,
      new AiSdkClient({
        apiKey: "synthetic-only",
        baseURL: `${server.url.origin}/v1`,
        model: "synthetic",
      }),
      { roleCatalog: catalog, boardConfig: twelvePlayerStandardConfig, llmTimeoutMs: 2000 },
    );
    const acpProvider = new AcpActionProvider(acp.world, {
      roleCatalog: catalog,
      boardConfig: twelvePlayerStandardConfig,
      turnTimeoutMs: 2000,
      sessionFactory: {
        async createSession(sessionInput) {
          creations++;
          control = new WerewolfMcpControlServer(sessionInput.registry);
          const config = await control.start(process.execPath, [
            path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts"),
          ]);
          control.bindSession("knowledge-session");
          client = new Client({ name: "knowledge-test", version: "1.0.0" });
          await client.connect(
            new StdioClientTransport({
              command: config.command,
              args: config.args,
              env: Object.fromEntries(config.env.map((item) => [item.name, item.value])),
            }),
          );
          return {
            sessionId: "knowledge-session",
            async prompt(prompt) {
              acpPrompts.push(prompt);
              const turn = /(?:Current turn ID: |当前回合 ID：)(t\d+)/.exec(prompt)![1];
              const receipt = (
                await client!.callTool({
                  name: "submit_action",
                  arguments: {
                    turn_id: turn,
                    action: "speak",
                    arguments: { text: `turn-${acpPrompts.length}` },
                  },
                })
              ).structuredContent;
              expect(receipt).toMatchObject({ ok: true, accepted: true });
            },
            async cancel() {},
            async close() {
              await client!.close();
              await control!.close({ force: true });
            },
          };
        },
      },
    });
    try {
      for (const turn of [1, 2, 3]) {
        // 原机器标记字符串保持原样；断言仅说明领域 enum 类型，不改变实际标记或工具输入。
    for (const game of [sdk, acp])
          (
            game.world.getComponent(5, COMPONENT.Role)!.privateState as Record<
              string,
              unknown
            >
          ).revealed = turn === 2;
        expect(await sdkProvider.getAction(input)).toEqual({
          name: "speak",
          args: { text: `turn-${turn}` },
        });
        expect(await acpProvider.getAction(input)).toEqual({
          name: "speak",
          args: { text: `turn-${turn}` },
        });
        const hint = text(locale, "prompt.status.wolf_teammates", {
          teammates: turn === 2 ? "2, 3, 4, 5" : "2, 3, 4",
        });
        expect(
          requests[turn - 1].messages.filter((message: any) => message.role === "user").at(-1)
            .content,
        ).toContain(hint);
        expect(acpPrompts[turn - 1]).toContain(hint);
      }
      expect(creations).toBe(1);
      expect(requests).toHaveLength(3);
      expect(
        requests[1].messages.find((message: any) => message.role === "system").content,
      ).toContain(text(locale, "prompt.system.teammates", { teammates: "2, 3, 4" }));
    } finally {
      await sdkProvider.close();
      await acpProvider.close();
      await client?.close();
      await control?.close({ force: true });
      server.stop(true);
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual SDK/MCP reject non-knife heals, keep the turn open, and accept the correct marked target without consuming`, async () => {
    const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale }),
      acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
    for (const game of [sdk, acp])
      game.world
        .getComponent(9, COMPONENT.StatusMarks)!
        .add("WolfKillMark" as import("@ai-werewolf-arena/game-contract").StatusMark);
    const actions = [
      {
        turn_id: "t1",
        action: "use_potion",
        arguments: { target_id: 999, potion_type: PotionType.Heal },
      },
      {
        turn_id: "t1",
        action: "use_potion",
        arguments: { target_id: 10, potion_type: PotionType.Heal },
      },
      {
        turn_id: "t1",
        action: "use_potion",
        arguments: { target_id: 9, potion_type: PotionType.Heal },
      },
    ];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(input) {
        await input.json();
        return Response.json({
          id: "heal-target",
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
                tool_calls: actions.map((args, index) => ({
                  id: `call-${index}`,
                  type: "function",
                  function: { name: "submit_action", arguments: JSON.stringify(args) },
                })),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
    });
    const registry = new AcpTurnRegistry(acp.world),
      control = new WerewolfMcpControlServer(registry),
      client = new Client({ name: "heal-target", version: "1.0.0" });
    const config = await control.start(process.execPath, [
      path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts"),
    ]);
    control.bindSession("heal-target");
    const pending = registry.openTurn(request, "heal-target");
    try {
      await client.connect(
        new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: Object.fromEntries(config.env.map((item) => [item.name, item.value])),
        }),
      );
      const receipts: unknown[] = [];
      const result = await sdkLoop(sdk.world, (trace) =>
        receipts.push(
          ...trace.flatMap((step) => step.toolCalls.map((call) => JSON.parse(call.toolResult))),
        ),
      ).run(
        new AiSdkClient({
          apiKey: "synthetic-only",
          baseURL: `${server.url.origin}/v1`,
          model: "synthetic",
        }),
        request,
        [{ role: "user", content: "Correct the rejected heal target." }],
        2000,
        "t1",
      );
      const mcp: any[] = [];
      for (const arguments_ of actions)
        mcp.push(
          (await client.callTool({ name: "submit_action", arguments: arguments_ }))
            .structuredContent,
        );
      expect(receipts).toEqual(mcp);
      expect(mcp.map((receipt) => (receipt.ok ? "accepted" : receipt.error))).toEqual([
        "heal_target",
        "heal_target",
        "accepted",
      ]);
      expect(result.action).toEqual({
        name: "use_potion",
        args: { target_id: 9, potion_type: PotionType.Heal },
      });
      expect(await pending.action).toEqual(result.action);
      expect(getWitchState(sdk.world.getComponent(6, COMPONENT.Role)!)!.heal).toBe(
        1,
      );
      expect(getWitchState(acp.world.getComponent(6, COMPONENT.Role)!)!.heal).toBe(
        1,
      );
      if (locale === "en") expect(JSON.stringify(mcp)).not.toMatch(/\p{Script=Han}/u);
    } finally {
      registry.close();
      await client.close();
      await control.close({ force: true });
      server.stop(true);
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual SDK HTTP and MCP accept explicit empty gun after rejecting an invalid target`, async () => {
    const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale }),
      acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
    for (const game of [sdk, acp])
      game.world.getComponent(7, COMPONENT.Alive)!.alive = false;
    const sdkPermit = sdk.world.openDeathAction(7, "shoot", Phase.Day, 1),
      acpPermit = acp.world.openDeathAction(7, "shoot", Phase.Day, 1);
    const input: ActionRequest = {
      actorId: 7,
      phase: Phase.Day,
      allowedTools: ["shoot"],
      context: {
        day: 1,
        stage: "hunter_shot",
        trigger: "on_death",
        death_phase: Phase.Night,
        death_sources: [DeathCause.WolfKill],
        death_action_id: sdkPermit.id,
        visible_events: [],
        turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
      },
    };
    const actions = [
      { turn_id: "t1", action: "shoot", arguments: { target_id: 999 } },
      { turn_id: "t1", action: "shoot", arguments: { target_id: null } },
      { turn_id: "t1", action: "shoot", arguments: { target_id: 1 } },
    ];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(incoming) {
        await incoming.json();
        return Response.json({
          id: "empty-gun",
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
                tool_calls: actions.map((args, index) => ({
                  id: `call-${index}`,
                  type: "function",
                  function: { name: "submit_action", arguments: JSON.stringify(args) },
                })),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
    });
    const registry = new AcpTurnRegistry(acp.world),
      control = new WerewolfMcpControlServer(registry),
      client = new Client({ name: "empty-gun", version: "1.0.0" });
    try {
      const config = await control.start(process.execPath, [
        path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts"),
      ]);
      control.bindSession("empty-gun");
      const pending = registry.openTurn(input, "empty-gun");
      await client.connect(
        new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: Object.fromEntries(config.env.map((item) => [item.name, item.value])),
        }),
      );
      const receipts: unknown[] = [];
      const result = await sdkLoop(sdk.world, (trace) =>
        receipts.push(
          ...trace.flatMap((step) => step.toolCalls.map((call) => JSON.parse(call.toolResult))),
        ),
      ).run(
        new AiSdkClient({
          apiKey: "synthetic-only",
          baseURL: `${server.url.origin}/v1`,
          model: "synthetic",
        }),
        input,
        [{ role: "user", content: "Choose a legal target or explicitly pass." }],
        2000,
        "t1",
      );
      const mcp: any[] = [];
      for (const arguments_ of actions)
        mcp.push(
          (await client.callTool({ name: "submit_action", arguments: arguments_ }))
            .structuredContent,
        );
      expect(receipts).toEqual(mcp);
      expect(mcp.map((receipt) => (receipt.ok ? "accepted" : receipt.error))).toEqual([
        "shoot_target",
        "accepted",
        "turn_not_open_or_session_invalid",
      ]);
      expect(result.action).toEqual({ name: "shoot", args: { target_id: null } });
      expect(await pending.action).toEqual(result.action);
      expect(
        getHunterState(sdk.world.getComponent(7, COMPONENT.Role)!)!.canShoot,
      ).toBe(true);
      expect(
        getHunterState(acp.world.getComponent(7, COMPONENT.Role)!)!.canShoot,
      ).toBe(true);
      if (locale === "en") expect(JSON.stringify(mcp)).not.toMatch(/\p{Script=Han}/u);
    } finally {
      sdkPermit.close();
      acpPermit.close();
      registry.close();
      await client.close();
      await control.close({ force: true });
      server.stop(true);
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual SDK HTTP and stdio MCP reject a gifted-instance request borrowing a native gun permit`, async () => {
    const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale }),
      acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
    for (const game of [sdk, acp])
      game.world.getComponent(7, COMPONENT.Alive)!.alive = false;
    const sdkPermit = sdk.world.openDeathAction(7, "shoot", Phase.Day, 1),
      acpPermit = acp.world.openDeathAction(7, "shoot", Phase.Day, 1);
    const input: ActionRequest = {
      actorId: 7,
      phase: Phase.Day,
      allowedTools: ["shoot"],
      context: {
        day: 1,
        stage: "death_shot",
        trigger: "on_death",
        death_action_id: sdkPermit.id,
        ability_id: "gift:1",
        action_failure_policy: "error",
        visible_events: [],
        turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
      },
    };
    const actions = Array.from({ length: 4 }, (_, index) => ({
      turn_id: "t1",
      action: "shoot",
      arguments: { target_id: index === 3 ? null : 1 },
    }));
    let responses = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(incoming) {
        await incoming.json();
        const first = responses++ === 0;
        return Response.json({
          id: "wrong-gun-instance",
          object: "chat.completion",
          created: 1,
          model: "synthetic",
          choices: [
            {
              index: 0,
              finish_reason: first ? "tool_calls" : "stop",
              message: {
                role: "assistant",
                content: first ? null : "Stopped after refusals.",
                ...(first
                  ? {
                      tool_calls: actions.map((args, index) => ({
                        id: `call-${index}`,
                        type: "function",
                        function: { name: "submit_action", arguments: JSON.stringify(args) },
                      })),
                    }
                  : {}),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
    });
    const registry = new AcpTurnRegistry(acp.world),
      control = new WerewolfMcpControlServer(registry),
      client = new Client({ name: "wrong-gun-instance", version: "1.0.0" });
    let transport: StdioClientTransport | undefined;
    try {
      const config = await control.start(process.execPath, [
        path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts"),
      ]);
      control.bindSession("wrong-gun-instance");
      const acpInput = structuredClone(input);
      acpInput.context.death_action_id = acpPermit.id;
      const pending = registry.openTurn(acpInput, "wrong-gun-instance");
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: Object.fromEntries(config.env.map((item) => [item.name, item.value])),
      });
      await client.connect(transport);
      const receipts: unknown[] = [],
        result = await sdkLoop(sdk.world, (trace) =>
          receipts.push(
            ...trace.flatMap((step) => step.toolCalls.map((call) => JSON.parse(call.toolResult))),
          ),
        ).run(
          new AiSdkClient({
            apiKey: "synthetic-only",
            baseURL: `${server.url.origin}/v1`,
            model: "synthetic",
          }),
          input,
          [{ role: "user", content: "Submit this turn's action." }],
          2000,
          "t1",
        );
      const mcp: any[] = [];
      for (const arguments_ of actions)
        mcp.push(
          (await client.callTool({ name: "submit_action", arguments: arguments_ }))
            .structuredContent,
        );
      expect(receipts).toHaveLength(4);
      expect(receipts.slice(0, 3)).toEqual(mcp.slice(0, 3));
      expect(receipts[3]).toMatchObject({ ok: false, error: "turn_invalid_action_limit" });
      expect(mcp.map((receipt) => receipt.error)).toEqual([
        "death_action_unavailable",
        "death_action_unavailable",
        "death_action_unavailable",
        "turn_not_open_or_session_invalid",
      ]);
      expect(result.action).toBeNull();
      expect(result.failureCode).toBe("turn_invalid_action_limit");
      expect(await pending.action).toBeNull();
      for (const game of [sdk, acp]) {
        expect(
          getHunterState(game.world.getComponent(7, COMPONENT.Role)!)!.canShoot,
        ).toBe(true);
        expect(game.world.getAliveEntityIds()).toContain(1);
      }
      if (locale === "en") expect(JSON.stringify(mcp)).not.toMatch(/\p{Script=Han}/u);
    } finally {
      sdkPermit.close();
      acpPermit.close();
      registry.close();
      const pid = transport?.pid;
      await client.close();
      await control.close({ force: true });
      server.stop(true);
      if (pid) {
        try {
          process.kill(pid, 0);
          throw new Error("mcp_child_still_alive");
        } catch (error) {
          expect((error as NodeJS.ErrnoException).code).toBe("ESRCH");
        }
      }
    }
    expect(sdk.world.activeDeathActionCount).toBe(0);
    expect(acp.world.activeDeathActionCount).toBe(0);
  });

for (const locale of ["zh-CN", "en"] as const)
  for (const scenario of [
    "exile_target",
    "lost_vote",
    "nomination",
    "sheriff_vote",
    "candidate_vote",
  ] as const)
    test(`${locale}: actual SDK HTTP and MCP share public participation refusals (${scenario})`, async () => {
      const { EventRegistry } = await import("../../../../src/game/engine/event_registry");
      const sdk = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale }),
        acp = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale });
      for (const game of [sdk, acp]) new EventRegistry().onVotedOut(game.world, 8, []);
      const action =
        scenario === "nomination"
          ? "run_for_sheriff"
          : scenario === "sheriff_vote" || scenario === "candidate_vote"
            ? "vote_for_sheriff"
            : "vote";
      const actorId = scenario === "exile_target" || scenario === "candidate_vote" ? 9 : 8;
      const arguments_ =
        action === "run_for_sheriff"
          ? { run: true }
          : { target_id: scenario === "exile_target" ? 8 : 9, abstain: false };
      const expected =
        scenario === "exile_target"
          ? "vote_target"
          : scenario === "lost_vote"
            ? "vote_right"
            : scenario === "nomination"
              ? "sheriff_nomination_eligibility"
              : "sheriff_vote_eligibility";
      const input: ActionRequest = {
        actorId,
        phase: action === "vote" ? Phase.Voting : Phase.Day,
        allowedTools: [action],
        context: {
          day: 1,
          stage:
            action === "vote"
              ? "voting"
              : action === "run_for_sheriff"
                ? "sheriff_nomination"
                : "sheriff_vote",
          sheriff_candidates: [9],
          visible_events: [],
          turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
        },
      };
      const submission = { turn_id: "t1", action, arguments: arguments_ };
      let calls = 0;
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(incoming) {
          await incoming.json();
          calls++;
          return Response.json({
            id: "public-participation",
            object: "chat.completion",
            created: 1,
            model: "synthetic",
            choices: [
              {
                index: 0,
                finish_reason: calls === 1 ? "tool_calls" : "stop",
                message:
                  calls === 1
                    ? {
                        role: "assistant",
                        content: null,
                        tool_calls: [
                          {
                            id: "call-1",
                            type: "function",
                            function: {
                              name: "submit_action",
                              arguments: JSON.stringify(submission),
                            },
                          },
                        ],
                      }
                    : { role: "assistant", content: "Done" },
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          });
        },
      });
      const registry = new AcpTurnRegistry(acp.world),
        control = new WerewolfMcpControlServer(registry),
        client = new Client({ name: "public-participation", version: "1.0.0" });
      try {
        const config = await control.start(process.execPath, [
          path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts"),
        ]);
        control.bindSession("public-participation");
        const pending = registry.openTurn(input, "public-participation");
        await client.connect(
          new StdioClientTransport({
            command: config.command,
            args: config.args,
            env: Object.fromEntries(config.env.map((item) => [item.name, item.value])),
          }),
        );
        const receipts: unknown[] = [];
        const result = await sdkLoop(sdk.world, (trace) =>
          receipts.push(
            ...trace.flatMap((step) => step.toolCalls.map((call) => JSON.parse(call.toolResult))),
          ),
        ).run(
          new AiSdkClient({
            apiKey: "synthetic-only",
            baseURL: `${server.url.origin}/v1`,
            model: "synthetic",
          }),
          input,
          [{ role: "user", content: "Attempt the requested action." }],
          2000,
          "t1",
        );
        const receipt = (await client.callTool({ name: "submit_action", arguments: submission }))
          .structuredContent;
        expect(receipts).toEqual([receipt]);
        expect(receipt).toMatchObject({ ok: false, error: expected });
        expect(result.action).toBeNull();
        registry.close();
        expect(await pending.action).toBeNull();
        for (const game of [sdk, acp]) {
          expect(game.world.getComponent(8, COMPONENT.Alive)!.alive).toBe(true);
          expect(
            game.world.getComponent(8, COMPONENT.VotingRight),
          ).toMatchObject({ canVote: false, weight: 0 });
          expect(
            game.world.getComponent(9, COMPONENT.Badge)!.isSheriff,
          ).toBe(false);
        }
        if (locale === "en") expect(JSON.stringify(receipt)).not.toMatch(/\p{Script=Han}/u);
      } finally {
        registry.close();
        await client.close();
        await control.close({ force: true });
        server.stop(true);
      }
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual SDK HTTP and MCP share dead badge authorization and read-only choice receipts`, async () => {
    const config = {
      ...twelvePlayerStandardConfig,
      initialSheriffSeat: 7,
      sheriff: { voteWeight: 2.25, badgePolicy: "awa_holder_choice_v1" as const },
    };
    const sdk = bootstrapGame(config, { fixedRoles: roles, locale });
    const acp = bootstrapGame(config, { fixedRoles: roles, locale });
    sdk.world.getComponent(7, COMPONENT.Alive)!.alive = false;
    acp.world.getComponent(7, COMPONENT.Alive)!.alive = false;
    const sdkPermit = sdk.world.openDeathAction(7, "choose_badge_successor", Phase.Voting, 2);
    const acpPermit = acp.world.openDeathAction(7, "choose_badge_successor", Phase.Voting, 2);
    const choice: ActionRequest = {
      actorId: 7,
      phase: Phase.Voting,
      allowedTools: ["choose_badge_successor"],
      context: {
        day: 2,
        stage: "sheriff_badge_choice",
        trigger: "badge_handoff",
        death_action_id: sdkPermit.id,
        badge_candidates: [1, 9],
        visible_events: [],
        turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
      },
    };
    const submissions = [
      { turn_id: "stale", action: "choose_badge_successor", arguments: { target_id: 9 } },
      { turn_id: "t1", action: "choose_badge_successor", arguments: { target_id: false } },
      { turn_id: "t1", action: "choose_badge_successor", arguments: { target_id: 10 } },
      { turn_id: "t1", action: "choose_badge_successor", arguments: { target_id: "9" } },
    ];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(input) {
        await input.json();
        return Response.json({
          id: "synthetic-badge",
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
                tool_calls: submissions.map((args, index) => ({
                  id: `badge-${index}`,
                  type: "function",
                  function: { name: "submit_action", arguments: JSON.stringify(args) },
                })),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
    });
    const registry = new AcpTurnRegistry(acp.world);
    const control = new WerewolfMcpControlServer(registry);
    const client = new Client({ name: "badge-reception", version: "1.0.0" });
    const controlConfig = await control.start(process.execPath, [
      path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts"),
    ]);
    control.bindSession("badge-session");
    const pending = registry.openTurn(
      { ...choice, context: { ...choice.context, death_action_id: acpPermit.id } },
      "badge-session",
    );
    try {
      await client.connect(
        new StdioClientTransport({
          command: controlConfig.command,
          args: controlConfig.args,
          env: Object.fromEntries(controlConfig.env.map((item) => [item.name, item.value])),
        }),
      );
      const sdkReceipts: unknown[] = [];
      const result = await sdkLoop(sdk.world, (trace) =>
        sdkReceipts.push(
          ...trace.flatMap((step) => step.toolCalls.map((call) => JSON.parse(call.toolResult))),
        ),
      ).run(
        new AiSdkClient({
          apiKey: "synthetic-only",
          baseURL: `${server.url.origin}/v1`,
          model: "synthetic",
        }),
        choice,
        [{ role: "user", content: "Select the badge successor." }],
        2000,
        "t1",
      );
      const acpReceipts: unknown[] = [];
      for (const args of submissions)
        acpReceipts.push(
          (await client.callTool({ name: "submit_action", arguments: args })).structuredContent,
        );
      expect(sdkReceipts).toEqual(acpReceipts);
      expect(sdkReceipts).toMatchObject([
        { ok: false, error: "turn_id_mismatch" },
        { ok: false, error: "invalid_tool_arguments" },
        { ok: false, error: "badge_choice_target" },
        { ok: true, accepted: true, applied: false, action: "choose_badge_successor" },
      ]);
      expect(result.action).toEqual({ name: "choose_badge_successor", args: { target_id: 9 } });
      expect(await pending.action).toEqual(result.action);
      for (const game of [sdk, acp])
        expect(game.world.getComponent(7, COMPONENT.Badge)?.isSheriff).toBe(
          true,
        );
      sdkPermit.close();
      acpPermit.close();
      expect(
        new ToolGateway().validateAndSanitize(sdk.world, 7, result.action!, {
          phase: Phase.Voting,
          day: 2,
          deathActionId: sdkPermit.id,
          badgeCandidates: [1, 9],
        }).ok,
      ).toBe(false);
    } finally {
      sdkPermit.close();
      acpPermit.close();
      await client.close();
      await control.close();
      server.stop(true);
    }
  });
