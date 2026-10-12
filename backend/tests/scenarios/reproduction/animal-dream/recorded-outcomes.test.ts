/**
 * Reproduction scenarios verify Animal Dream literal recorded games preserve exact night deaths and terminal survivor facts.
 * Input: Original six scenario names, skip and first-night matrices with the declared animalGolden expectation table.
 * Output and oracle: Literal winner/alive/night assertions inspect the actual Record and replay; existing action matrices and archival fixture bytes are unchanged.
 */
import { expect, test } from "bun:test";
import { recordAnimalLiteral } from "../../../support/animal_dream_recording";
import { animalGolden } from "../../../support/animal_dream_scenarios";
for (const name of [
  "fox_beauty",
  "cat_badge",
  "puffer_knife",
  "pk",
  "last_chain",
  "full_retaliation",
] as const)
  for (const skip of [false, true])
    for (const first of [false, true])
      test(`Animal real Record and exact Tape ${name}/${skip}/${first}`, async () => {
        const r = await recordAnimalLiteral(name, "en", skip, first),
          expected = animalGolden(name, skip, first);
        expect(r.replay.snapshot.result?.winner).toBe(expected.winner);
        expect(
          r.record.checkpoints
            .at(-1)!
            .players.filter((p) => p.alive)
            .map((p) => p.id),
        ).toEqual(expected.alive);
        expect(
          r.record.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
        ).toEqual(expected.night);
      }, 30000);
