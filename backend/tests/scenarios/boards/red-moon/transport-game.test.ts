/**
 * Scenario tests for complete Red Moon games over real local transports.
 * Inputs are original controlled action plans plus transport/language matrices;
 * outputs retain terminal, player-view and strict reproduction comparisons.
 * Winner/alive expectations come from the driver’s production rehearsal and are
 * consistency checks, not independent rules oracles. Literal event-count and
 * rejection assertions remain separate handwritten checks. Synthetic local
 * model/ACP processes exercise the wire; no billed model is called.
 */
import { expect, test } from "bun:test";
import { redMoonScenario } from "../../../support/features/red-moon-apostle/drivers/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
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
