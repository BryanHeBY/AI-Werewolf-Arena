/**
 * 传输集成测试：验证在受控辉光／蚀月回合中提交真实 MCP 行动。输入为原保留的 wire 能力与局部录制配置；关闭／过期回执、已付效果和库存为字面预期，旧能力不能提交到另一代，不启动计费模型。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  COMPONENT,
  PotionType,
  type ActionRequest,
  type RoleComponent,
  type ToolCall,
} from "../../../../src/core";
import { AcpTurnRegistry } from "../../../../src/ai/integrations/acp/acp_turn_registry";
import { WerewolfMcpControlServer } from "../../../../src/ai/integrations/acp/werewolf_mcp_control";
import { radiantFixture } from "../../../support/features/radiant-eclipse/builders/runtime-game";
import { radiantProvider } from "../../../support/features/radiant-eclipse/drivers/actions";
import { radiantManualAction } from "../../../support/features/radiant-eclipse/drivers/manual-actions";
import { fixtureObject } from "../../../support/oracles/fixture-values";

// The retained client/control belong to this adversarial test, not a provider session.
// Real runner tests separately prove provider-owned transport/process reclamation.
for (const boundary of [
  {
    stage: "eclipse_swallow",
    day: 2,
    actor: 1,
    plan: "independent-stock-card16-card17",
    action: { name: "swallow_skill", args: { target_id: 4 } },
  },
  {
    stage: "radiant_shelter",
    day: 2,
    actor: 2,
    plan: "independent-stock-card16-card17",
    action: { name: "cast_shelter", args: { target_id: 12 } },
  },
  {
    stage: "witch",
    day: 2,
    actor: 1,
    plan: "independent-stock-card16-card17",
    action: { name: "use_potion", args: { target_id: 12, potion_type: PotionType.Poison } },
  },
  {
    stage: "dreamer",
    day: 2,
    actor: 1,
    plan: "borrowed-dream-death-badge-words",
    action: { name: "dream", args: { target_id: 7 } },
  },
  {
    stage: "radiant_shelter",
    day: 3,
    actor: 1,
    plan: "independent-stock-card16-card17",
    action: { name: "cast_shelter", args: { target_id: 5 } },
  },
  {
    stage: "seer",
    day: 4,
    actor: 1,
    plan: "independent-stock-card16-card17",
    action: { name: "check_identity", args: { target_id: 2 } },
  },
] as const)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Radiant real MCP late/closed/stale submission ${boundary.stage}/D${boundary.day}/P${boundary.actor}/${locale}`, async () => {
      const game = await radiantFixture(locale);
      const manual = radiantProvider([], {}, (q) => radiantManualAction(q, boundary.plan));
      const registry = new AcpTurnRegistry(game.world),
        control = new WerewolfMcpControlServer(registry);
      const client = new Client({ name: "retained-radiant-client", version: "1" });
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
