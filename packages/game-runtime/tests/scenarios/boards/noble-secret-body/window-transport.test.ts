/**
 * 完整真实传输场景验证活跃夜之贵族窗口在原中断点关闭。
 * 输入为固定中断场景及持有原绑定请求的合成 Agent。
 * 输出与独立预期为字面自爆／死亡顺序、没有陈旧后续决定，以及精确终局／协议预期。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import { Phase } from "../../../../src/domain";
import { nobleTransportScenario } from "../../../support/features/noble-secret-body/builders/transport-plan";
import { assertNobleTransportWire } from "../../../support/features/noble-secret-body/oracles/wire";
import { assertNobleTransportGolden } from "../../../support/features/noble-secret-body/oracles/transport-golden";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const name of [
  "noble_pre_election_blast",
  "noble_pre_vote_blast",
  "ordinary_pre_election_blast",
  "ordinary_pre_vote_blast",
] as const)
  for (const kind of ["llm", "acp", "mixed"] as const)
    test(`actual Noble live interruption ${name}/${kind}`, async () => {
      const scenario = nobleTransportScenario(name, {
        wolf: name.startsWith("ordinary_") ? "no_blast_no_self_knife" : "standard",
      });
      for (const locale of ["en", "zh-CN"] as const) {
        const run = await runTransportGame(scenario, kind, locale);
        assertNobleTransportWire(run);
        assertNobleTransportGolden(run.record, scenario);
        if (!("blast" in scenario.plan)) throw Error("fixture_blast_plan_missing");
        const b = scenario.plan.blast;
        expect(
          run.record.events.filter((e) => e.type === "wolf_self_destruct").map((e) => e.payload),
        ).toEqual([{ wolfId: scenario.mapping.get(b.actor)!, window: b.stage }]);
        expect(run.record.decisions.some((d) => d.day === b.day && d.stage === "voting")).toBe(
          false,
        );
        if (b.stage === "on_pre_election")
          expect(
            run.record.decisions.some((d) => d.day === 1 && d.stage === "sheriff_nomination"),
          ).toBe(false);
        const cp = run.record.checkpoints[b.day]!;
        expect(cp.snapshot.phase).toBe(Phase.Night);
        expect(cp.snapshot.day).toBe(b.day + 1);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          scenario.alive,
        );
        expect(run.result.snapshot.result!.winner).toBe(scenario.winner);
        expect(run.rejected.size).toBe(0);
      }
    }, 120000);
