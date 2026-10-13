/**
 * Builds original animal-dream test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { Role } from "../../../../../src/core";
import { animalDreamTwelveConfig } from "../../../../../src/runtime/scenarios/animal_dream_twelve";
import type { BoardConfig } from "../../../../../src/core";
import { bootstrapGame } from "../../../../../src/app/bootstrap";
import { createRandom } from "../../../../../src/core";

export const animalRoles = [
  Role.WolfBeauty,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.WhiteCat,
  Role.FoxCub,
  Role.Bear,
  Role.Pufferfish,
];

export function animalBoard(skip = false, first = false): BoardConfig {
  return {
    ...animalDreamTwelveConfig,
    whiteCat: {
      skippedVotePolicy: skip ? "awa_expire_on_skipped_day_v1" : "awa_wait_for_actual_exile_v1",
    },
    pufferfish: { ballotPolicy: first ? "awa_first_ballot_v1" : "awa_final_ballot_v1" },
  };
}

export function animalGame(locale: "zh-CN" | "en" = "zh-CN", skip = false, first = false) {
  return bootstrapGame(animalBoard(skip, first), {
    fixedRoles: animalRoles,
    locale,
    random: createRandom("animal-literal-v1"),
  });
}
