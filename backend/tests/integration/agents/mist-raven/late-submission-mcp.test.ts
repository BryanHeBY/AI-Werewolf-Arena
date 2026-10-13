/**
 * 传输集成测试：验证在受控雾鸦回合中提交真实 MCP 行动。输入为原保留的 session 能力；晚到／关闭／过期回执及事实不变采用字面预期，撤权请求不能消费，不启动计费模型。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  type ActionRequest,
  type RoleComponent,
  type ToolCall,
} from "../../../../src/core";
import { AcpTurnRegistry } from "../../../../src/ai/integrations/acp/acp_turn_registry";
import { WerewolfMcpControlServer } from "../../../../src/ai/integrations/acp/werewolf_mcp_control";
import { MIST_ROLES, mistBoard } from "../../../support/features/mist-raven/builders/board";
import { fixtureObject } from "../../../support/oracles/fixture-values";

// The retained client/control belong to this adversarial test, not a provider session.
// Real runner tests separately prove provider-owned transport/process reclamation.
for (const stage of ["alchemist_mist", "alchemist_snake", "raven_knife"] as const)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Mist real MCP late/closed/stale submission ${stage}/${locale}`, async () => {
      const board = await mistBoard(),
        game = bootstrapGame(board.config, { fixedRoles: MIST_ROLES, locale });
      const registry = new AcpTurnRegistry(game.world),
        control = new WerewolfMcpControlServer(registry);
      const client = new Client({ name: "retained-mist-client", version: "1" });
      let transport: StdioClientTransport | undefined;
      let pid: number | undefined;
      let captured!: (request: ActionRequest) => void, release!: () => void;
      const requestReady = new Promise<ActionRequest>((resolve) => (captured = resolve));
      const released = new Promise<void>((resolve) => (release = resolve));
      const stop = new Error("fixture_target_finished");
      let cycle: Promise<void> | undefined;
      try {
        const config = await control.start(process.execPath, [
          path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts"),
        ]);
        control.bindSession("retained");
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: Object.fromEntries(config.env.map((e) => [e.name, e.value])),
        });
        await client.connect(transport);
        pid = transport.pid ?? undefined;
        expect(Number.isSafeInteger(pid) && pid! > 0).toBe(true);
        cycle = (async () => {
          for (let day = 1; day <= 2; day++)
            await game.phaseManager.runSingleCycle(
              {
                async getAction(request) {
                  if (request.context.stage === stage) {
                    captured(request);
                    await released;
                    throw stop;
                  }
                  const tool = request.allowedTools[0];
                  switch (tool) {
                    case "cast_mist":
                      return { name: tool, args: { target_ids: null } };
                    case "dream":
                      return { name: tool, args: { target_id: request.context.day === 1 ? 8 : 5 } };
                    case "speak_to_wolves":
                      return { name: tool, args: { text: "Done", end_chat: true } };
                    case "kill_vote":
                      return {
                        name: tool,
                        args: { target_id: request.context.day === 1 ? 11 : 3, abstain: false },
                      };
                    case "check_identity":
                      return { name: tool, args: { target_id: 9 } };
                    case "run_for_sheriff":
                      return { name: tool, args: { run: false } };
                    case "speak":
                      return { name: tool, args: { text: "Words" } };
                    case "use_snake":
                      return { name: tool, args: { target_id: null } };
                    case "vote":
                      return {
                        name: tool,
                        args: {
                          target_id: request.actorId === 12 ? null : 12,
                          abstain: request.actorId === 12,
                        },
                      };
                    case "self_destruct":
                      return null;
                    default:
                      throw new Error("fixture_unplanned_held_stage:" + request.context.stage);
                  }
                },
              },
              8,
            );
          throw new Error("fixture_target_not_reached");
        })();
        // If an earlier phase fails, reject promptly instead of hanging on the handoff.
        const request = await Promise.race([
          requestReady,
          cycle.then(() => {
            throw new Error("fixture_target_not_reached");
          }),
        ]);
        const role = game.world.getComponent(request.actorId, COMPONENT.Role)!;
        const state = structuredClone(role.privateState),
          events = structuredClone(game.phaseManager.getEvents());
        const action: ToolCall =
          stage === "alchemist_mist"
            ? { name: "cast_mist", args: { target_ids: [5, 6, 7] } }
            : stage === "alchemist_snake"
              ? { name: "use_snake", args: { target_id: null } }
              : { name: "raven_knife", args: { target_id: 5 } };
        const pending = registry.openTurn(
          { ...request, deadlineAtMs: Date.now() + 1000 },
          "retained",
        );
        const submit = async (turnId: string) => {
          const result = await client.callTool({
            name: "submit_action",
            arguments: { turn_id: turnId, action: action.name, arguments: action.args },
          });
          if (locale === "en") expect(JSON.stringify(result)).not.toMatch(/\p{Script=Han}/u);
          return fixtureObject(result.structuredContent);
        };
        expect(registry.snapshot.pending).toBe(1);
        await new Promise((resolve) => setTimeout(resolve, 2200));
        expect(await submit(pending.turnId)).toMatchObject({
          ok: false,
          error: "turn_not_open_or_session_invalid",
        });
        expect(role.privateState).toEqual(state);
        expect(game.phaseManager.getEvents()).toEqual(events);
        registry.closeTurn("retained");
        expect(await pending.action).toBeNull();
        expect(await submit(pending.turnId)).toMatchObject({
          ok: false,
          error: "turn_not_open_or_session_invalid",
        });
        const next = registry.openTurn(
          { ...request, deadlineAtMs: Date.now() + 10000 },
          "retained",
        );
        expect(await submit(pending.turnId)).toMatchObject({
          ok: false,
          error: "turn_id_mismatch",
        });
        expect(registry.snapshot.pending).toBe(1);
        expect(await submit(next.turnId)).toMatchObject({ ok: true, accepted: true });
        expect(await next.action).toEqual(action);
        expect(role.privateState).toEqual(state); // Reception never performs engine effects.
        expect(game.phaseManager.getEvents()).toEqual(events);
        const locallyClosed = registry.openTurn(
          { ...request, deadlineAtMs: Date.now() + 10000 },
          "retained",
        );
        registry.closeTurn("retained");
        expect(await locallyClosed.action).toBeNull();
        expect(await submit(locallyClosed.turnId)).toMatchObject({
          ok: false,
          error: "turn_not_open_or_session_invalid",
        });
        const globallyClosed = registry.openTurn(
          { ...request, deadlineAtMs: Date.now() + 10000 },
          "retained",
        );
        registry.close();
        expect(await globallyClosed.action).toBeNull();
        expect(await submit(globallyClosed.turnId)).toMatchObject({
          ok: false,
          error: "turn_not_open_or_session_invalid",
        });
        expect(registry.snapshot).toEqual({ closed: true, pending: 0 });
      } finally {
        registry.close();
        release();
        const outcome = await cycle?.then(
          () => undefined,
          (error) => error,
        );
        await client.close();
        await control.close({ force: true });
        if (outcome !== undefined && outcome !== stop) throw outcome;
        if (pid !== undefined) {
          try {
            process.kill(pid, 0);
            throw new Error("fixture_mcp_process_still_alive");
          } catch (error) {
            expect((error as NodeJS.ErrnoException).code).toBe("ESRCH");
          }
        }
      }
    }, 15000);
