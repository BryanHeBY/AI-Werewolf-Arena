/**
 * 传输集成测试：验证在受控动物梦境前缀中提交真实 MCP 行动。输入为原 retained wire 能力；晚到／关闭／过期回执、库存及状态采用字面预期，原能力不能再次提交，不启动计费模型。
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
import { animalGame } from "../../../support/features/animal-dream/builders/runtime-game";
import { animalAction } from "../../../support/features/animal-dream/drivers/actions";
import { inheritAnimalDeadlineRequest } from "../../../../src/features/animal-dream/requests";
import { fixtureObject } from "../../../support/oracles/fixture-values";

// 保留的客户端与 control 属于本对抗测试，不属于 provider 会话。
// 真实 runner 测试另行证明 provider 所有的传输与进程会被回收。
for (const boundary of [
  {
    stage: "fox_distract",
    day: 2,
    actor: 10,
    plan: "fox_beauty",
    action: { name: "fox_distract", args: { target_id: 1 } },
  },
  {
    stage: "puffer_reaction",
    day: 1,
    actor: 12,
    plan: "full_retaliation",
    action: { name: "puffer_retaliate", args: { activate: true } },
  },
] as const)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Animal real MCP late/closed/stale submission ${boundary.stage}/D${boundary.day}/P${boundary.actor}/${locale}`, async () => {
      const game = animalGame(locale);
      const manual = { getAction: (r: ActionRequest) => animalAction(r, boundary.plan) };
      const registry = new AcpTurnRegistry(game.world),
        control = new WerewolfMcpControlServer(registry);
      const client = new Client({ name: "retained-animal-client", version: "1" });
      let transport: StdioClientTransport | undefined;
      let pid: number | undefined;
      let captured!: (request: ActionRequest) => void, release!: () => void;
      const requestReady = new Promise<ActionRequest>((resolve) => (captured = resolve));
      const released = new Promise<void>((resolve) => (release = resolve));
      const stop = new Error("fixture_target_finished");
      let cycle: Promise<void> | undefined;
      try {
        const config = await control.start(process.execPath, [
          path.resolve(import.meta.dir, "../../../../src/adapters/acp/werewolf-mcp-server.ts"),
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
        // 若更早阶段失败，应立即拒绝，避免一直等待交接。
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
        inheritAnimalDeadlineRequest(request, tight);
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
