/**
 * 完整真实传输场景验证夜之贵族的狼人策略与秘密之身重复保护策略分支。
 * 输入为公开策略组合及固定合成 SDK／ACP／混合场景行动。
 * 输出与独立预期为合法决定次数字面值、终局 checkpoint 及行动者各自的协议知识。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import { nobleTransportScenario } from "../../../support/features/noble-secret-body/builders/transport-plan";
import { assertNobleTransportWire } from "../../../support/features/noble-secret-body/oracles/wire";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const wolf of ["standard", "no_blast_no_self_knife"] as const)
  for (const repeat of ["awa_nonconsecutive_nights_v1", "awa_repeat_v1"] as const)
    for (const kind of ["llm", "acp", "mixed"] as const)
      test(`actual Noble policies ${wolf}/${repeat}/${kind}`, async () => {
        const scenario = nobleTransportScenario("expiry", { wolf, repeat });
        for (const locale of ["en", "zh-CN"] as const) {
          const run = await runTransportGame(scenario, kind, locale);
          assertNobleTransportWire(run);
          expect(run.result.snapshot.result!.winner).toBe(scenario.winner);
          const n = run.record.checkpoints.at(-1)!.nobleBody!;
          expect(n.noble.wolfActionPolicy).toBe(wolf);
          expect(n.body.protectionRepeatPolicy).toBe(repeat);
          expect(
            run.record.decisions
              .filter((d) => d.actorId === scenario.mapping.get(5) && d.stage === "secret_body")
              .map((d) =>
                d.outcome.kind === "action" && d.outcome.action?.name === "protect_secret_body"
                  ? d.outcome.action.args.target_id
                  : undefined,
              ),
          ).toEqual([
            scenario.mapping.get(6)!,
            scenario.mapping.get(repeat === "awa_repeat_v1" ? 6 : 7)!,
            scenario.mapping.get(6)!,
          ]);
          const noble = run.record.decisions.filter((d) => d.actorId === scenario.mapping.get(1)!);
          expect(
            noble.filter((d) => ["on_pre_election", "on_pre_vote"].includes(d.stage)).length > 0,
          ).toBe(wolf === "standard");
          expect(noble.some((d) => d.stage === "wolf_vote")).toBe(true);
          expect(noble.some((d) => d.stage === "wolf_discussion")).toBe(true);
          expect(run.rejected.size).toBe(0);
        }
      }, 120000);
