/**
 * Responsibility: assert the existing finite Ghost Bride configuration type.
 * Input: a board config; output: its original refinement or preset error.
 * Rulesets own supported combinations. This assertion never installs a wedding,
 * allocates resources or grants live knife authority.
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { isGhostBridePreset } from "../../../../rulesets";
import { GHOST_BRIDE_POLICY } from "@ai-werewolf-arena/game-text";
import type {} from "../../../../core/domain";
export type GhostBrideBoard = ReadonlyBoardConfig & {
  readonly ghostBride: { readonly policy: typeof GHOST_BRIDE_POLICY };
};
/** Shared pure validation covers public parsing, bootstrap, authority installation, and Tape. */
export function assertGhostBridePreset(
  config: ReadonlyBoardConfig,
): asserts config is GhostBrideBoard {
  if (!isGhostBridePreset(config)) throw new Error("ghost_bride_preset_invalid");
}
