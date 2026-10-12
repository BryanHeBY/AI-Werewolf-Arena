/**
 * Responsibility: assert the existing finite Ghost Bride configuration type.
 * Input: a board config; output: its original refinement or preset error.
 * Rulesets own supported combinations. This assertion never installs a wedding,
 * allocates resources or grants live knife authority.
 */
import { isGhostBridePreset } from "../../../../rulesets";
import { GHOST_BRIDE_POLICY } from "@ai-werewolf-arena/game-text";
import type { BoardConfig } from "../../../../core/domain";
export type GhostBrideBoard = BoardConfig & { ghostBride: { policy: typeof GHOST_BRIDE_POLICY } };
/** Shared pure validation covers public parsing, bootstrap, authority installation, and Tape. */
export function assertGhostBridePreset(config: BoardConfig): asserts config is GhostBrideBoard {
  if (!isGhostBridePreset(config)) throw new Error("ghost_bride_preset_invalid");
}
