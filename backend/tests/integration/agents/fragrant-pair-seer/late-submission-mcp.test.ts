/**
 * 传输集成测试：验证在受控寻香对局前缀持有回合时提交真实 MCP 行动。输入为原 retained wire 能力；晚到／关闭／过期回执、库存与状态采用字面预期，撤权后不恢复提交，不启动计费模型。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  COMPONENT,
  type ActionRequest,
  type RoleComponent,
  type ToolCall,
} from "../../../../src/domain";
import { AcpTurnRegistry } from "../../../../src/adapters/acp/acp-turn-registry";
import { WerewolfMcpControlServer } from "../../../../src/adapters/acp/werewolf-mcp-control";
import { fragrantRuntimeGame } from "../../../support/features/fragrant-pair-seer/builders/runtime-game";
import { fragrantRuntimeAction } from "../../../support/features/fragrant-pair-seer/drivers/actions";
import { inheritFragrantPairDeadlineRequest } from "../../../../src/features/fragrant-pair-seer/requests";
import { fixtureObject } from "../../../support/oracles/fixture-values";

// The retained client/control belong to this adversarial test, not a provider session.
// Real runner tests separately prove provider-owned transport/process reclamation.
for (const boundary of [
  {
    stage: "fragrant_bind",
    day: 1,
    actor: 1,
    action: { name: "bind_fragrant_pair", args: { target_ids: [5, 6] } },
  },
  {
    stage: "pair_inspection",
    day: 1,
    actor: 9,
    action: { name: "check_pair", args: { target_ids: [9, 2] } },
  },
] as const)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Fragrant real MCP late/closed/stale submission ${boundary.stage}/D${boundary.day}/P${boundary.actor}/${locale}`, async () => {
      const game = fragrantRuntimeGame(locale);
      const manual = { getAction: fragrantRuntimeAction };
      const registry = new AcpTurnRegistry(game.world),
        control = new WerewolfMcpControlServer(registry);
      const client = new Client({ name: "retained-fragrant-client", version: "1" });
      let transport: StdioClientTransport | undefined;
      let pid: number | undefined;
      let captured!: (request: ActionRequest) => void, release!: () => void;
      const requestReady = new Promise<ActionRequest>((resolve) => (captured = resolve));
      const released = new Promise<void>((resolve) => (release = resolve));
      const stop = new Error("fixture_target_finished");
      let cycle: Promise<void> | undefined;
      try {
        const config = await control.start(process.execPath, [
          path.resolve(process.cwd(), "src/adapters/acp/werewolf-mcp-server.ts"),
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
          for (let day = 1; day <= boundary.day; day++)
            await game.phaseManager.runSingleCycle(
              {
                async getAction(request) {
                  if (
                    request.context.stage === boundary.stage &&
                    request.context.day === boundary.day &&
                    request.actorId === boundary.actor
                  ) {
                    captured(request);
                    await released;
                    throw stop;
                  }
                  return manual.getAction(request);
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
        const action: ToolCall = boundary.action;
        const prior = registry.openTurn(request, "retained");
        registry.closeTurn("retained");
        expect(await prior.action).toBeNull();
        const tight = { ...request, deadlineAtMs: Date.now() + 1000 };
        inheritFragrantPairDeadlineRequest(request, tight);
        const pending = registry.openTurn(tight, "retained");
        const submit = async (turnId: string) => {
          const result = await client.callTool({
            name: "submit_action",
            arguments: { turn_id: turnId, action: action.name, arguments: action.args },
          });
          if (locale === "en") expect(JSON.stringify(result)).not.toMatch(/\p{Script=Han}/u);
          return fixtureObject(result.structuredContent);
        };
        expect(await submit(prior.turnId)).toMatchObject({ ok: false, error: "turn_id_mismatch" });
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
        const locallyClosed = registry.openTurn(tight, "retained");
        registry.closeTurn("retained");
        expect(await locallyClosed.action).toBeNull();
        expect(await submit(locallyClosed.turnId)).toMatchObject({
          ok: false,
          error: "turn_not_open_or_session_invalid",
        });
        registry.close();
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
