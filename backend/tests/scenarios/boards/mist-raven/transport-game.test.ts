/**
 * Scenario tests execute linked, saved-dreamer, protected-heal and draw Mist/Raven games through bilingual SDK, ACP and mixed transports.
 * Inputs are the original scripted plans; literal unsealing, learned identities, night deaths, actor-only facts and final golden outcomes are the oracle.
 * The transport driver owns local child/recording resources. Optional caller-selected archive exports keep their old boundaries; default tests neither overwrite goldens nor call a billed model.
 */
import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mistTransportScenario } from "../../../support/features/mist-raven/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const variant of ["linked", "saved-dreamer", "protected-heal", "draw"] as const)
  for (const kind of ["llm", "acp", "mixed"] as const)
    test(`Mist Raven actual bilingual SDK/ACP/MCP complete ${variant}/${kind}`, async () => {
      const scenario = await mistTransportScenario(variant);
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["en", "zh-CN"] as const) {
        const run = await runTransportGame(scenario, kind, locale);
        runs.push(run);
        expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          scenario.alive,
        );
        expect(
          run.replay.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
        ).toEqual(scenario.nightDeaths);
        expect(
          run.replay.events.filter((e) => e.type === "raven_unsealed").map((e) => e.payload),
        ).toEqual([
          {
            actorId: scenario.raven,
            day: scenario.unsealDay,
            awakened: true,
            knownTeammateIds: scenario.known,
          },
        ]);
        expect(run.rejected.size).toBe(0);
        expect(run.acpTraces.every((t) => t.trace.rejected === 0)).toBe(true);
        for (const view of run.views) {
          const mine = view.timeline.filter(
            (t) => t.kind === "event" && t.event.type.startsWith("alchemist_"),
          );
          if (view.player_id !== scenario.alchemist) expect(mine).toHaveLength(0);
          expect(
            view.timeline.some((t) => t.kind === "event" && t.event.type === "raven_unsealed"),
          ).toBe(view.player_id === scenario.raven);
        }
        if (kind === "llm" && process.env.AWA_MIST_RAVEN_FIXTURES) {
          const directory = process.env.AWA_MIST_RAVEN_FIXTURES;
          await mkdir(path.join(directory, "player-views"), { recursive: true });
          const name = `mist-normal-${variant}-${locale}`;
          await writeFile(
            path.join(directory, name + ".replay.json"),
            JSON.stringify(run.replay, null, 2) + "\n",
          );
          await writeFile(
            path.join(directory, name + ".checkpoint.txt"),
            JSON.stringify(run.record.checkpoints.at(-1), null, 2) + "\n",
          );
          for (const [label, actor] of [
            ["alchemist", scenario.alchemist],
            ["raven", scenario.raven],
            ["pack", 5],
            ["villager", 2],
          ] as const)
            await writeFile(
              path.join(directory, "player-views", `${name}-${label}.player.json`),
              JSON.stringify(
                run.views.find((v) => v.player_id === actor),
                null,
                2,
              ) + "\n",
            );
        }
      }
      expect(runs[0]!.result).toEqual(runs[1]!.result);
      expect(runs[0]!.record.checkpoints).toEqual(runs[1]!.record.checkpoints);
    }, 120000);
