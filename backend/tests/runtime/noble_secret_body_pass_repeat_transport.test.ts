import { expect, test } from "bun:test";
import { nobleTransportScenario } from "../support/noble_secret_body_transport_scenarios";
import { assertNobleTransportWire } from "../support/noble_secret_body_wire_oracle";
import { assertNobleTransportGolden } from "../support/noble_secret_body_transport_golden";
import { assertNobleBadgeRules } from "../support/noble_secret_body_badge_prompt";
import { runTransportGame } from "../support/run_transport_game";
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
