import { expect, test } from "bun:test";
import { mistTransportScenario } from "../support/mist_raven_transport_scenarios";
import { runTransportGame } from "../support/run_transport_game";
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
      }
      expect(runs[0]!.result).toEqual(runs[1]!.result);
      expect(runs[0]!.record.checkpoints).toEqual(runs[1]!.record.checkpoints);
    }, 120000);
