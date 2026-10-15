/**
 * 场景测试负责双爪及亲传原板的真实本地SDK/ACP/MCP完整传输。输入为两语和手写两夜计划，
 * 字面胜方、存活表、两次私有消费／中立实际枪击与受众为独立预期，驱动附带严格Tape与资源关闭检查。
 * 第二枪missing/late保第一真死亡及一枚未付库存；不调用付费模型，不把Provider return当付款。
 */
import { expect, test } from "bun:test";
import { awakenedWolfKingScenario } from "../../../support/features/awakened-wolf-king/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const kind of ["double_claw", "bequest"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`King完整真实传输/${kind}/${transport}/两语`, async () => {
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = awakenedWolfKingScenario(kind),
          run = await runTransportGame(scenario, transport, locale);
        expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          scenario.alive,
        );
        expect(run.record.events.filter((e) => e.type === "awakened_claw_bequeathed")).toHaveLength(
          kind === "bequest" ? 1 : 0,
        );
        expect(run.record.events.filter((e) => e.type === "awakened_claw_spent")).toHaveLength(2);
        expect(
          run.record.events
            .filter((e) => e.type === "player_shot")
            .map((e) => [e.payload.actorId, e.payload.targetId]),
        ).toEqual(
          kind === "bequest"
            ? [
                [scenario.king, scenario.seer],
                [scenario.recipient, scenario.witch],
              ]
            : [
                [scenario.king, scenario.seer],
                [scenario.king, scenario.merchant],
              ],
        );
        for (const view of run.views) {
          const events = view.timeline.filter((r) => r.kind === "event").map((r) => r.event);
          expect(events.filter((e) => e.type === "awakened_claw_spent")).toHaveLength(
            view.player_id === scenario.king
              ? kind === "bequest"
                ? 1
                : 2
              : kind === "bequest" && view.player_id === scenario.recipient
                ? 1
                : 0,
          );
          expect(events.filter((e) => e.type === "awakened_claw_bequeathed")).toHaveLength(
            kind === "bequest" && [scenario.king, scenario.recipient].includes(view.player_id)
              ? 1
              : 0,
          );
          expect(events.filter((e) => e.type === "player_shot")).toHaveLength(2);
        }
      }
    }, 120000);
for (const transport of ["llm", "acp"] as const)
  for (const failure of ["missing", "late"] as const)
    test(`King第二真枪请求/${transport}/${failure}保首枪完整前缀`, async () => {
      const scenario = awakenedWolfKingScenario("double_claw"),
        rows = scenario.turns.get(scenario.king)!,
        second = rows.filter((r) => r.stage === "death_shot")[1]!;
      second.terminalFailure = failure;
      if (failure === "missing") {
        second.action = null;
        if (transport === "llm")
          rows.splice(rows.indexOf(second), 1, ...Array.from({ length: 4 }, () => ({ ...second })));
      }
      scenario.expectedFailure = { actorId: scenario.king, stage: "death_shot" };
      const run = await runTransportGame(scenario, transport, "en"),
        cp = run.record.checkpoints.at(-1)!;
      expect(cp.complete).toBe(false);
      expect(
        run.record.events.filter((e) => e.type === "player_shot").map((e) => e.payload.targetId),
      ).toEqual([scenario.seer]);
      expect(run.record.events.filter((e) => e.type === "awakened_claw_spent")).toHaveLength(1);
      expect(cp.players.find((p) => p.id === scenario.seer)!.alive).toBe(false);
      expect(cp.players.find((p) => p.id === scenario.merchant)!.alive).toBe(true);
      const state = cp.players.find((p) => p.id === scenario.king)!.privateState.awakenedClaws as {
        units: Array<{ status: string }>;
      };
      expect(state.units.map((u) => u.status)).toEqual(["spent", "ready"]);
    }, 120000);
