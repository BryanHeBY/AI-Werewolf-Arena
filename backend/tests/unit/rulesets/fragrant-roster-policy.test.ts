/**
 * Unit test verifies Fragrant finite preset accepts only the native roster and fixed source policies.
 * Input: Original imported board and five literal field alterations.
 * Output and oracle: Exact accepted base and rejected variants remain unchanged; no World, cycle, filesystem or model is created.
 */
import { expect, test } from "bun:test";
import { fragrantPairSeerTwelveConfig } from "../../../src/runtime/scenarios/fragrant_pair_seer_twelve";
import { isFragrantPairSeerPreset } from "../../../src/rulesets";

test("finite preset accepts only its native roster and fixed source policies", () => {
  expect(isFragrantPairSeerPreset(fragrantPairSeerTwelveConfig)).toBe(true);
  for (const changed of [
    { boardSize: 10 },
    { guard: { repeatPolicy: "awa_last_action_v1" } },
    { witch: { ...fragrantPairSeerTwelveConfig.witch, canSelfHeal: "first_night_only" } },
    { seer: { targetPolicy: "awa_alive_v1" } },
    { mistRaven: { policy: "awa_mist_raven_v1" } },
  ])
    expect(isFragrantPairSeerPreset({ ...fragrantPairSeerTwelveConfig, ...changed })).toBe(false);
});
