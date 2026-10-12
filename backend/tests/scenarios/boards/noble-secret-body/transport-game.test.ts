/**
 * Complete real-transport scenarios verify Noble/Body death, expiry and cross-night player knowledge.
 * Input: Literal named scenarios over synthetic SDK/ACP/mixed agents and both locales.
 * Output and independent oracle: Independent terminal/death/badge goldens, handwritten knowledge anchors and actual serialized prefixes.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { nobleTransportScenario } from "../../../support/noble_secret_body_transport_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";
import { assertNobleTransportWire } from "../../../support/features/noble-secret-body/oracles/wire";
import { assertNobleBadgeRules } from "../../../support/features/noble-secret-body/oracles/badge-prompt";
import { assertNobleTransportGolden } from "../../../support/features/noble-secret-body/oracles/transport-golden";
import { assertNobleKnownAnchors } from "../../../support/features/noble-secret-body/oracles/known-anchors";
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
        assertNobleBadgeRules(run, locale);
        assertNobleTransportGolden(run.record, scenario);
        assertNobleKnownAnchors(run, scenario);
        if (kind === "llm" && process.env.AWA_NOBLE_FIXTURES) {
          const directory = process.env.AWA_NOBLE_FIXTURES,
            fixture = `noble-${name}-${locale}`;
          await mkdir(path.join(directory, "player-views"), { recursive: true });
          await writeFile(
            path.join(directory, `${fixture}.replay.json`),
            JSON.stringify(run.replay, null, 2) + "\n",
          );
          await writeFile(
            path.join(directory, `${fixture}.checkpoint.txt`),
            JSON.stringify(run.record.checkpoints.at(-1), null, 2) + "\n",
          );
          for (const [label, old] of [
            ["noble", 1],
            ["body", 5],
            ["demon", 4],
            ["pack", 10],
            ["villager", 9],
          ] as const)
            await writeFile(
              path.join(directory, "player-views", `${fixture}-${label}.player.json`),
              JSON.stringify(
                run.views.find((v) => v.player_id === scenario.mapping.get(old)),
                null,
                2,
              ) + "\n",
            );
        }
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
