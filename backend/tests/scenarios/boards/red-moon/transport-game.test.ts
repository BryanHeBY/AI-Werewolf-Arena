/**
 * Scenario tests for complete red-moon games over real local transports.
 * Input: original fixed scenario actions, transport and language matrices;
 * output: unchanged terminal, player-view and strict reproduction assertions.
 * Literal winners, alive seats and causal facts are the independent oracle.
 * Synthetic local model/ACP processes exercise the wire; no billed model runs.
 */
import { expect, test } from "bun:test";
import { redMoonScenario } from "../../../support/red_moon_transport_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";
for (const mode of ["expire", "knife", "blast"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(
      "Red Moon true transport " + mode + "/" + transport,
      async () => {
        const scenario = await redMoonScenario(mode);
        for (const locale of ["zh-CN", "en"] as const) {
          const run = await runTransportGame(scenario, transport, locale);
          if (transport === "llm" && process.env.AWA_RED_MOON_FIXTURE_DIR) {
            const base = process.env.AWA_RED_MOON_FIXTURE_DIR + "/red-moon-" + mode + "-" + locale;
            await Bun.write(base + ".replay.json", JSON.stringify(run.replay, null, 2) + "\n");
            await Bun.write(
              base + ".checkpoint.txt",
              JSON.stringify(run.record.checkpoints.at(-1), null, 2) + "\n",
            );
          }

          expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
          expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
            scenario.alive,
          );
          expect(run.replay.events.filter((e) => e.type === "red_moon_night_sealed")).toHaveLength(
            mode === "blast" ? 1 : 0,
          );
          expect(run.replay.events.filter((e) => e.type === "red_moon_exile_delayed")).toHaveLength(
            mode === "blast" ? 0 : 1,
          );
          expect(run.replay.events.filter((e) => e.type === "red_moon_delay_expired")).toHaveLength(
            mode === "expire" ? 1 : 0,
          );
          expect(run.rejected.size).toBe(0);
          expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
        }
      },
      180000,
    );
