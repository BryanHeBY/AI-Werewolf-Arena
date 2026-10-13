/**
 * Complete real-transport scenarios verify Noble wolf and Body repetition policy variants.
 * Input: Public policy combinations and fixed synthetic SDK/ACP/mixed scenario actions.
 * Output and independent oracle: Literal legal decision counts, terminal checkpoints and actor-specific wire knowledge.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
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
