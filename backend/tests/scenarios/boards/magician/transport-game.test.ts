/**
 * Scenario tests for complete magician games over real local transports.
 * Input: original fixed scenario actions, transport and language matrices;
 * output: unchanged terminal, player-view and strict reproduction assertions.
 * Literal winners, alive seats and causal facts are the independent oracle.
 * Synthetic local model/ACP processes exercise the wire; no billed model runs.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { magicianScenario } from "../../../support/magician_transport_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";
for (const shot of ["original", "exchanged"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`Magician bilingual real transport, private exchange and night gun/${shot}/${transport}`, async () => {
      const scenario = magicianScenario(shot),
        runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const run = await runTransportGame(scenario, transport, locale);
        runs.push(run);
        expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          scenario.alive,
        );
        expect(
          run.replay.events.filter((e) => e.type === "magician_exchange_committed"),
        ).toHaveLength(2);
        expect(run.replay.events.filter((e) => e.type === "death_shot_missed")).toHaveLength(
          shot === "exchanged" ? 1 : 0,
        );
        for (const view of run.views) {
          const facts = view.timeline.filter(
            (row) => row.kind === "event" && row.event.type === "magician_exchange_committed",
          );
          expect(facts).toHaveLength(view.player_id === scenario.magician ? 2 : 0);
          for (const row of facts)
            if (row.kind === "event")
              expect(Object.keys(row.event.payload).sort()).toEqual(["day", "pair"]);
        }
        expect(run.rejected.size).toBe(0);
        expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
        expect(run.replay.events.filter((e) => e.type === "game_over")).toHaveLength(1);
        if (transport === "llm" && process.env.AWA_MAGICIAN_FIXTURES) {
          const directory = process.env.AWA_MAGICIAN_FIXTURES;
          await mkdir(directory, { recursive: true });
          const base = join(directory, "magician-" + shot + "-" + locale);
          await writeFile(base + ".replay.json", JSON.stringify(run.replay, null, 2) + "\n");
          await writeFile(
            base + ".checkpoint.txt",
            JSON.stringify(run.record.checkpoints.at(-1), null, 2) + "\n",
          );
        }
      }
      expect(runs[0]!.result).toEqual(runs[1]!.result);
      expect(runs[0]!.record.checkpoints).toEqual(runs[1]!.record.checkpoints);
    }, 120000);
