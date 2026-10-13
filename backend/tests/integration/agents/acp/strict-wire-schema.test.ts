/**
 * 集成测试验证 strict-wire-schema 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  type ActionRequest,
  type RoleComponent,
} from "../../../../src/core";
import { AcpActionProvider } from "../../../../src/ai/agents/acp/acp_action_provider";
import { WerewolfMcpControlServer } from "../../../../src/ai/integrations/acp/werewolf_mcp_control";
import { gameToolProtocol } from "../../../../src/ai/agents/game_tool_protocol";
import { getGuardState } from "../../../../src/game/mechanisms/roles/guard/ports";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

const roles = [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager];
const modes = [
  "missing_arguments",
  "invalid_action_type",
  "reject3",
  "correct_after_two",
  "stale_turn",
  "helper_errors",
  "helper_wait",
] as const;
for (const locale of ["zh-CN", "en"] as const)
  for (const mode of modes)
    test(`${locale}/${mode}: production stdio MCP preserves canonical schema and attributes only current-turn submission failures`, async () => {
      const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles, locale });
      const request: ActionRequest = {
        actorId: 5,
        phase: Phase.Night,
        allowedTools: ["guard"],
        context: {
          day: 1,
          stage: "guard",
          action_failure_policy: "error",
          visible_events: [],
          turn_constraints: { min_valid_actions: 0, max_valid_actions: 1 },
        },
      };
      let control: WerewolfMcpControlServer | undefined,
        client: Client | undefined,
        transport: StdioClientTransport | undefined,
        pid: number | undefined,
        closes = 0,
        fallbacks = 0;
      const receipts: any[] = [];
      let before: any, after: any;
      const provider = new AcpActionProvider(world, {
        turnTimeoutMs: 4000,
        privilegedFallbackProvider: {
          async getAction() {
            fallbacks++;
            return null;
          },
        },
        sessionFactory: {
          async createSession(input) {
            control = new WerewolfMcpControlServer(input.registry);
            const config = await control.start(process.execPath, [
              path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts"),
            ]);
            control.bindSession("strict-wire");
            client = new Client({ name: "strict-wire", version: "1.0.0" });
            transport = new StdioClientTransport({
              command: config.command,
              args: config.args,
              env: Object.fromEntries(config.env.map((entry) => [entry.name, entry.value])),
            });
            await client.connect(transport);
            pid = transport.pid ?? undefined;
            before = await client.listTools();
            const canonical = gameToolProtocol(locale).specs.find(
              (spec) => spec.name === "submit_action",
            )!.parameters;
            const schema = before.tools.find(
              (tool: any) => tool.name === "submit_action",
            ).inputSchema;
            expect(schema.properties).toEqual(canonical.properties);
            expect([...schema.required].sort()).toEqual(
              [...(canonical.required as string[])].sort(),
            );
            return {
              sessionId: "strict-wire",
              async prompt(prompt) {
                const turnId = /(?:Current turn ID: |当前回合 ID：)(t\d+)/.exec(prompt)![1];
                const submit = async (arguments_: Record<string, unknown>) => {
                  const result = await client!.callTool({
                    name: "submit_action",
                    arguments: arguments_,
                  });
                  receipts.push(result.structuredContent);
                  return result;
                };
                if (mode === "helper_errors" || mode === "helper_wait") {
                  for (let i = 0; i < 3; i++) {
                    const result = await client!.callTool({
                      name: "report_bug",
                      arguments: {
                        turn_id: turnId,
                        category: "invalid",
                        severity: "invalid",
                        message: "",
                      },
                    });
                    expect(result.isError).toBe(true);
                  }
                  expect(input.registry.snapshot.pending).toBe(1);
                  if (mode === "helper_wait") {
                    after = await client!.listTools();
                    expect(after).toEqual(before);
                    return;
                  }
                } else {
                  const attempts = mode === "correct_after_two" ? 2 : 3;
                  for (let i = 0; i < attempts; i++) {
                    const args =
                      mode === "missing_arguments"
                        ? { turn_id: turnId, action: "guard" }
                        : mode === "invalid_action_type"
                          ? { turn_id: turnId, action: 7, arguments: {} }
                          : mode === "stale_turn"
                            ? { turn_id: "t999", action: "guard" }
                            : {
                                turn_id: turnId,
                                action: "guard",
                                arguments: { target_id: 999, abstain: false },
                              };
                    const result = await submit(args);
                    expect(result.isError).toBe(true);
                  }
                }
                const valid = await submit({
                  turn_id: turnId,
                  action: "guard",
                  arguments: { target_id: 6, abstain: false },
                });
                expect(valid.isError === true).toBe(
                  ["missing_arguments", "invalid_action_type", "reject3"].includes(mode),
                );
                after = await client!.listTools();
                expect(after).toEqual(before);
              },
              async cancel() {},
              async close() {
                closes++;
                await client!.close();
                await control!.close({ force: true });
              },
            };
          },
        },
      });
      const manager = await SessionRecordManager.create(
        {
          sessionId: `strict-wire-${mode}-${locale}`,
          board: "synthetic",
          locale,
          startedAtIso: new Date(0).toISOString(),
        },
        await createTestTempDirectory("awa-strict-wire-"),
      );
      try {
        await runWithSessionRecorder(manager, async () => {
          if (mode === "helper_wait") expect(await provider.getAction(request)).toBeNull();
          else if (["correct_after_two", "stale_turn", "helper_errors"].includes(mode))
            expect(await provider.getAction(request)).toEqual({
              name: "guard",
              args: { target_id: 6, abstain: false },
            });
          else await expect(provider.getAction(request)).rejects.toThrow("action_turn_failed");
          await provider.close();
        });
        expect(fallbacks).toBe(0);
        expect(closes).toBe(1);
        expect(
          getGuardState(world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.lastTarget,
        ).toBeNull();
        const summary = await manager.finalize({
          endedAtIso: new Date(1).toISOString(),
          winner: null,
          finishReason: "test",
          players: [],
        });
        const view = summary.playerViews.find((view) => view.player_id === 5)!;
        if (["missing_arguments", "invalid_action_type", "reject3"].includes(mode)) {
          expect(
            view.timeline.some(
              (entry) =>
                entry.kind === "turn" &&
                entry.delta_messages.some((message) => message.kind === "constraint_warning"),
            ),
          ).toBe(true);
          expect(JSON.stringify(view)).toContain("turn_invalid_action_limit");
          expect(JSON.stringify(view)).not.toContain("transport_error");
          expect(receipts.at(-1).error).toBe("turn_not_open_or_session_invalid");
        }
        if (mode === "stale_turn")
          expect(receipts.slice(0, 3).map((result) => result.error)).toEqual([
            "turn_id_mismatch",
            "turn_id_mismatch",
            "turn_id_mismatch",
          ]);
        if (locale === "en") expect(JSON.stringify(receipts)).not.toMatch(/\p{Script=Han}/u);
        expect(Number.isSafeInteger(pid)).toBe(true);
        try {
          process.kill(pid!, 0);
          throw new Error("mcp_child_still_alive");
        } catch (error) {
          expect((error as NodeJS.ErrnoException).code).toBe("ESRCH");
        }
      } finally {
        await provider.close();
        await client?.close();
        await control?.close({ force: true });
      }
    }, 15000);
