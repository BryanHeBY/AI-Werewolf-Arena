/**
 * Responsibility: expose the existing typed Demon Hunter setup assertion.
 * Input: a board configuration; output: its original refined board type or the
 * original preset error. Rulesets own the support verdict and Node snapshot
 * ingress. This assertion never creates domain state or grants hunt authority.
 */
import type { BoardConfig } from "../../../../core";
import { isDemonHunterNodePreset as isDemonHunterPreset } from "../../../../rulesets";
export { isDemonHunterNodePreset as isDemonHunterPreset } from "../../../../rulesets";
import { DEMON_HUNTER_POLICY } from "./state";
export type DemonHunterBoard = BoardConfig & {
  demonHunter: { policy: typeof DEMON_HUNTER_POLICY };
};
export function assertDemonHunterPreset(input: BoardConfig): asserts input is DemonHunterBoard {
  if (!isDemonHunterPreset(input)) throw new Error("demon_hunter_preset_invalid");
}
