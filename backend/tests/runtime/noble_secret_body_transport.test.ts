import { expect, test } from "bun:test";
import { nobleTransportScenario } from "../support/noble_secret_body_transport_scenarios";
import { runTransportGame } from "../support/run_transport_game";
import { assertNobleTransportWire } from "../support/noble_secret_body_wire_oracle";
import { assertNobleTransportGolden } from "../support/noble_secret_body_transport_golden";
import { assertNobleKnownAnchors } from "../support/noble_secret_body_known_anchors";
for (const name of [
  "expiry",
  "new_and_old_clear",
  "two_sources",
  "pending_last_wolf",
  "badge_reveal",
  "pending_at_end",
  "caster_death",
  "healed_target_fallback_then_exile",
  "self_poison_expiry",
  "toxin_immunity",
  "toxin_immunity_backlash",
  "dead_noble_expiry",
  "day_target_death_reopens",
  "first_night_death_pending_end",
  "clear_preserves_poison",
] as const)
  for (const kind of ["llm", "acp", "mixed"] as const)
    test(`actual Noble SDK ACP MCP complete ${name}/${kind}`, async () => {
      const scenario = nobleTransportScenario(name);
      for (const locale of ["en", "zh-CN"] as const) {
        const run = await runTransportGame(scenario, kind, locale);
        assertNobleTransportWire(run);
        assertNobleTransportGolden(run.record, scenario);
        assertNobleKnownAnchors(run, scenario);
        expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          scenario.alive,
        );
        expect(
          run.record.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
        ).toEqual(scenario.nightDeaths);
        expect(
          run.record.checkpoints
            .slice(1)
            .map((c) => c.players.filter((p) => p.alive).map((p) => p.id)),
        ).toEqual(scenario.cycleAlive);
        expect(run.rejected.size).toBe(0);
        if (name === "pending_at_end") {
          expect(run.record.checkpoints.at(-1)!.nobleBody!.noble.contracts).toEqual([
            {
              id: "servant:night:2",
              targetId: scenario.mapping.get(7)!,
              createdNight: 2,
              expiresNight: 3,
              status: { kind: "pending" },
            },
          ]);
          expect(run.record.events.some((e) => e.type === "noble_contract_closed")).toBe(false);
          expect(run.record.decisions.some((d) => d.day > 2)).toBe(false);
        }
        for (const v of run.views)
          for (const row of v.timeline)
            if (row.kind === "event") {
              expect(
                row.event.type.startsWith("noble_body_") ||
                  ["noble_contract_closed", "secret_body_blocked"].includes(row.event.type),
              ).toBe(false);
              if (["noble_servant_chosen", "noble_night_notified"].includes(row.event.type))
                expect(v.player_id).toBe(scenario.mapping.get(1)!);
              if (["secret_body_chosen", "secret_body_night_notified"].includes(row.event.type))
                expect(v.player_id).toBe(scenario.mapping.get(5)!);
            }
      }
    }, 120000);
