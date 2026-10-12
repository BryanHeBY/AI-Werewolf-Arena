import { assertRadiantTransportGolden } from "../support/features/radiant-eclipse/oracles/transport-golden";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertRadiantTransportWire } from "../support/features/radiant-eclipse/oracles/wire";
import { expect, test } from "bun:test";
import { radiantTransportScenario } from "../support/radiant_eclipse_transport_scenarios";
import { runTransportGame } from "../support/run_transport_game";
for (const name of [
  "last-wolf-borrow-backlash",
  "last-villager-saved-then-double-cause",
  "last-god-restored-dream-gap",
  "borrowed-dream-death-badge-words",
  "independent-stock-card16-card17",
  "zero-one-then-empty",
  "one-zero-borrow-heal",
] as const)
  for (const kind of ["llm", "acp", "mixed"] as const)
    test(`actual Radiant complete SDK+ACP+MCP ${name}/${kind}`, async () => {
      const scenario = await radiantTransportScenario(name);
      for (const locale of ["en", "zh-CN"] as const) {
        const run = await runTransportGame(scenario, kind, locale);
        assertRadiantTransportWire(run);
        assertRadiantTransportGolden(run.record, name);
        expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          scenario.alive,
        );
        expect(
          run.replay.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
        ).toEqual(scenario.nightDeaths);
        expect(run.rejected.size).toBe(0);
        if (kind === "llm" && process.env.AWA_RADIANT_FIXTURES) {
          const directory = process.env.AWA_RADIANT_FIXTURES;
          await mkdir(path.join(directory, "player-views"), { recursive: true });
          const fixture = `radiant-${name}-${locale}`;
          await writeFile(
            path.join(directory, `${fixture}.replay.json`),
            JSON.stringify(run.replay, null, 2) + "\n",
          );
          await writeFile(
            path.join(directory, `${fixture}.checkpoint.txt`),
            JSON.stringify(run.record.checkpoints.at(-1), null, 2) + "\n",
          );
          for (const [label, actor] of [
            ["maid", 10],
            ["count", 9],
            ["seer", 8],
            ["witch", 7],
            ["dreamer", 4],
            ["pack", 3],
            ["villager", 1],
          ] as const)
            await writeFile(
              path.join(directory, "player-views", `${fixture}-${label}.player.json`),
              JSON.stringify(
                run.views.find((v) => v.player_id === actor),
                null,
                2,
              ) + "\n",
            );
        }

        expect(
          run.record.decisions.some(
            (d) => d.actorId === scenario.maid && d.stage === "wolf_discussion",
          ),
        ).toBe(false);
        for (const view of run.views) {
          expect(
            view.timeline.some(
              (t) => t.kind === "event" && t.event.type === "eclipse_lease_closed",
            ),
          ).toBe(false);
          for (const entry of view.timeline)
            if (entry.kind === "event" && entry.event.type === "eclipse_swallowed")
              expect(view.player_id).toBe(scenario.maid);
        }
      }
    }, 120000);
