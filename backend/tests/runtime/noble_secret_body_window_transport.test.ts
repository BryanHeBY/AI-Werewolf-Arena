import { expect, test } from "bun:test";
import { Phase } from "../../src/core";
import { nobleTransportScenario } from "../support/noble_secret_body_transport_scenarios";
import { assertNobleTransportWire } from "../support/noble_secret_body_wire_oracle";
import { assertNobleTransportGolden } from "../support/noble_secret_body_transport_golden";
import { runTransportGame } from "../support/run_transport_game";
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
