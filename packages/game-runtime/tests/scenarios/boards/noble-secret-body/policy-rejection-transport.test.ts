/**
 * 场景测试负责真实传输中的贵族狼方／保护政策拒绝与纠正。输入为字面非法边界动作及后续合法提交，输出用精确拒绝数、接受的原动作与独立终局／wire 预期核对。
 * 本测试不调用计费模型，不重写 fixture 或 Tape 字节。
 */
import { expect, test } from "bun:test";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { nobleTransportScenario } from "../../../support/features/noble-secret-body/builders/transport-plan";
import { assertNobleTransportWire } from "../../../support/features/noble-secret-body/oracles/wire";
import { assertNobleTransportGolden } from "../../../support/features/noble-secret-body/oracles/transport-golden";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const boundary of ["nonconsecutive", "restricted_knife"] as const)
  for (const kind of ["llm", "acp", "mixed"] as const)
    test(`actual Noble policy rejects then corrects ${boundary}/${kind}`, async () => {
      const scenario = nobleTransportScenario("expiry", {
          wolf: boundary === "restricted_knife" ? "no_blast_no_self_knife" : "standard",
        }),
        actor = scenario.mapping.get(boundary === "nonconsecutive" ? 5 : 11)!,
        turn = scenario.turns
          .get(actor)!
          .find(
            (t) =>
              t.day === 2 &&
              t.stage === (boundary === "nonconsecutive" ? "secret_body" : "wolf_vote"),
          )!;
      turn.invalidActions =
        boundary === "nonconsecutive"
          ? [{ name: "protect_secret_body", args: { target_id: scenario.mapping.get(6)! } }]
          : [{ name: "kill_vote", args: { target_id: scenario.mapping.get(1)!, abstain: false } }];
      turn.expectedInvalidError =
        boundary === "nonconsecutive" ? RuleError.NobleBodyUnavailable : RuleError.KillTarget;
      for (const locale of ["en", "zh-CN"] as const) {
        const run = await runTransportGame(scenario, kind, locale);
        assertNobleTransportWire(run);
        assertNobleTransportGolden(run.record, scenario);
        expect(
          kind === "llm" || (kind === "mixed" && actor % 2 === 1)
            ? run.rejected.get(actor)
            : run.acpTraces.find((t) => t.actor === actor)!.trace.rejected,
        ).toBe(1);
        expect(run.result.snapshot.result!.winner).toBe(scenario.winner);
        expect(
          run.record.decisions.filter(
            (d) => d.actorId === actor && d.day === 2 && d.stage === turn.stage,
          ),
        ).toHaveLength(1);
      }
    }, 120000);
