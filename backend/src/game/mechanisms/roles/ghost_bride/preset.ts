import { GHOST_BRIDE_POLICY, isGhostBridePreset } from "@ai-werewolf-arena/game-text";
import type { BoardConfig } from "../../../../core/domain";
export type GhostBrideBoard = BoardConfig & { ghostBride: { policy: typeof GHOST_BRIDE_POLICY } };
/** Shared pure validation covers public parsing, bootstrap, authority installation, and Tape. */
export function assertGhostBridePreset(config: BoardConfig): asserts config is GhostBrideBoard {
  if (!isGhostBridePreset(config)) throw new Error("ghost_bride_preset_invalid");
}
