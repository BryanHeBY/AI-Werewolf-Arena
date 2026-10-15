/**
 * Scenario tests execute whole-night and first-effect Time Consort games through SDK, ACP and mixed transports in both locales.
 * Inputs are the original scripted guard/poison/check interactions; literal lock, reflection order, inspection, owner visibility and final golden results provide the oracle.
 * The transport driver owns children and recordings. Optional explicit archive exports preserve their output scope; default tests never rewrite goldens or call a billed model.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { timeConsortScenario } from "../../../support/features/time-wolf-consort/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const variant of ["whole_night", "first_effect"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(
      "Consort bilingual real transport/" + variant + "/" + transport,
      async () => {
        const scenario = timeConsortScenario(variant),
          runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
        for (const locale of ["zh-CN", "en"] as const) {
          const run = await runTransportGame(scenario, transport, locale);
          runs.push(run);
          expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
          expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
            scenario.alive,
          );
          const choices = run.replay.events.filter((e) => e.type === "time_consort_lock_committed");
          expect(choices).toHaveLength(1);
          expect(choices[0]!.payload.targetId).toBe(scenario.locked);
          const reflected = run.replay.events.filter((e) => e.type === "time_consort_reflected");
          expect(reflected.map((e) => e.payload.kind)).toEqual(
            variant === "whole_night" ? ["guard", "poison", "check"] : ["guard"],
          );
          const inspected = run.replay.events.find((e) => e.type === "seer_checked");
          expect(inspected?.payload.targetId).toBe(scenario.locked);
          expect(inspected?.payload.isWerewolf).toBe(variant === "first_effect");
          for (const view of run.views) {
            const locks = view.timeline.filter(
              (row) => row.kind === "event" && row.event.type === "time_consort_lock_committed",
            );
            expect(locks).toHaveLength(view.player_id === scenario.consort ? 1 : 0);
            expect(
              view.timeline.some(
                (row) => row.kind === "event" && row.event.type === "time_consort_reflected",
              ),
            ).toBe(false);
          }
          expect(run.rejected.size).toBe(0);
          expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
          if (transport === "llm" && process.env.AWA_TIME_CONSORT_FIXTURES) {
            const directory = process.env.AWA_TIME_CONSORT_FIXTURES;
            await mkdir(directory, { recursive: true });
            const base = join(directory, "time-consort-" + variant + "-" + locale);
            await writeFile(base + ".replay.json", JSON.stringify(run.replay, null, 2) + "\n");
            await writeFile(
              base + ".checkpoint.txt",
              JSON.stringify(run.record.checkpoints.at(-1), null, 2) + "\n",
            );
          }
        }
        expect(runs[0]!.result).toEqual(runs[1]!.result);
        expect(runs[0]!.record.checkpoints).toEqual(runs[1]!.record.checkpoints);
      },
      120000,
    );
