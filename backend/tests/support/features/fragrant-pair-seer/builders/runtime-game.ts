/**
 * Builds original fragrant-pair-seer test input plans, fixed boards and explicit player/marker data. Inputs
 * are supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { Role } from "../../../../../src/core/domain/identity";
import { bootstrapGame } from "../../../../../src/app/bootstrap";
import { fragrantPairSeerTwelveConfig } from "../../../../../src/runtime/scenarios/fragrant_pair_seer_twelve";
import { createRandom } from "../../../../../src/core/domain/random";
import type { RandomSource } from "../../../../../src/core/domain/random";

const fixed = [
  Role.FragrantPhantom,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.AwakenedSeer,
  Role.Witch,
  Role.Hunter,
  Role.Guard,
];

export function fragrantRuntimeGame(
  locale: "zh-CN" | "en" = "zh-CN",
  random: RandomSource = createRandom("fragrant-handwritten-runtime"),
) {
  return bootstrapGame(fragrantPairSeerTwelveConfig, {
    fixedRoles: fixed,
    random,
    locale,
  });
}
