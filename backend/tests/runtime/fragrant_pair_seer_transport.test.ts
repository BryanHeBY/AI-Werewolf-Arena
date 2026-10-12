import { assertFragrantTransportWire } from "../support/features/fragrant-pair-seer/oracles/wire";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "bun:test";
import { fragrantTransportScenario } from "../support/fragrant_pair_seer_transport_scenarios";
import { runTransportGame } from "../support/run_transport_game";
for (const name of [
  "inherited_gun",
  "first_link",
  "expiry",
  "dead_caster",
  "same_wave",
  "caster_gun",
  "link_hunter",
  "second_night",
  "protected",
  "badge",
  "pre_election_overlap",
  "pre_vote",
] as const)
  for (const kind of ["llm", "acp", "mixed"] as const)
    test(`actual Fragrant SDK ACP MCP ${name}/${kind}`, async () => {
      const scenario = fragrantTransportScenario(name);
      for (const locale of ["zh-CN", "en"] as const) {
        const r = await runTransportGame(scenario, kind, locale);
        if (kind === "llm" && process.env.AWA_FRAGRANT_FIXTURES) {
          const directory = process.env.AWA_FRAGRANT_FIXTURES,
            fixture = `fragrant-${name}-${locale}`;
          await mkdir(path.join(directory, "player-views"), { recursive: true });
          await writeFile(
            path.join(directory, fixture + ".replay.json"),
            JSON.stringify(r.replay, null, 2) + "\n",
          );
          await writeFile(
            path.join(directory, fixture + ".checkpoint.txt"),
            JSON.stringify(r.record.checkpoints.at(-1), null, 2) + "\n",
          );
          for (const [label, old] of [
            ["phantom", 1],
            ["seer", 9],
            ["villager", 8],
            ["pack", 4],
          ] as const)
            await writeFile(
              path.join(directory, "player-views", `${fixture}-${label}.player.json`),
              JSON.stringify(
                r.views.find((v) => v.player_id === scenario.mapping.get(old)),
                null,
                2,
              ) + "\n",
            );
        }
        assertFragrantTransportWire(r);
        expect(r.result.snapshot.result?.winner).toBe(scenario.winner);
        expect(r.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          scenario.alive,
        );
        expect(
          r.record.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
        ).toEqual(scenario.nightDeaths);
        expect(
          r.record.checkpoints
            .slice(1)
            .map((c) => c.players.filter((p) => p.alive).map((p) => p.id)),
        ).toEqual(scenario.cycleAlive);
        expect(r.rejected.size).toBe(0);
        for (const v of r.views)
          for (const row of v.timeline)
            if (row.kind === "event" && row.event.type.startsWith("fragrant_")) {
              expect([
                "fragrant_pair_chosen",
                "fragrant_pair_inspected",
                "fragrant_night_notified",
              ]).toContain(row.event.type);
              expect(row.event.payload.actorId).toBe(v.player_id);
            }
      }
    }, 120000);
