/**
 * 完整真实传输场景验证夜之贵族／秘密之身明确跳过会重置重复保护限制。
 * 输入为合成传输上的固定跳过／重复选择及配置策略。
 * 输出与独立预期为手写夜死／保护顺序、精确 checkpoint 值，以及独立警徽／协议预期。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import { nobleTransportScenario } from "../../../support/features/noble-secret-body/builders/transport-plan";
import { assertNobleTransportWire } from "../../../support/features/noble-secret-body/oracles/wire";
import { assertNobleTransportGolden } from "../../../support/features/noble-secret-body/oracles/transport-golden";
import { assertNobleBadgeRules } from "../../../support/features/noble-secret-body/oracles/badge-prompt";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const wolf of ["standard", "no_blast_no_self_knife"] as const)
  for (const repeat of ["awa_nonconsecutive_nights_v1", "awa_repeat_v1"] as const)
    test(`actual Noble pass resets repeat ${wolf}/${repeat}`, async () => {
      const scenario = nobleTransportScenario("pass_breaks_repeat", { wolf, repeat });
      for (const locale of ["en", "zh-CN"] as const) {
        const run = await runTransportGame(scenario, "llm", locale);
        assertNobleTransportWire(run);
        assertNobleTransportGolden(run.record, scenario);
        assertNobleBadgeRules(run, locale);
        expect(run.record.checkpoints.slice(1).map((cp) => cp.nobleBody!.body.lastChoice)).toEqual([
          { day: 1, targetId: scenario.mapping.get(6)! },
          { day: 2, targetId: null },
          { day: 3, targetId: scenario.mapping.get(6)! },
          { day: 4, targetId: scenario.mapping.get(5)! },
        ]);
        for (const cp of run.record.checkpoints) {
          expect(cp.nobleBody!.body.body).toEqual({ kind: "intact" });
          expect(cp.nobleBody!.noble.contracts).toEqual([]);
        }
        expect(
          run.record.events.some(
            (e) => e.type === "secret_body_blocked" || e.type === "secret_body_revealed",
          ),
        ).toBe(false);
        expect(
          run.record.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
        ).toEqual([[], [], [], []]);
        expect(run.result.snapshot.result!.winner).toBe(scenario.winner);
        expect(run.rejected.size).toBe(0);
      }
    }, 120000);
