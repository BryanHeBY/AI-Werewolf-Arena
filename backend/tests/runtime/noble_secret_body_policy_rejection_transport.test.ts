import { expect, test } from "bun:test";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { nobleTransportScenario } from "../support/noble_secret_body_transport_scenarios";
import { assertNobleTransportWire } from "../support/noble_secret_body_wire_oracle";
import { assertNobleTransportGolden } from "../support/noble_secret_body_transport_golden";
import { runTransportGame } from "../support/run_transport_game";
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
