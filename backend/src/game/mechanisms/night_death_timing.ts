/**
 * Describes whether the existing finite board families settle night deaths before day.
 * Input is readonly board parameter data; output is the original timing boolean.
 * This pure query never advances a phase, resolves damage or installs feature state.
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type {} from "../../core/domain/board";
/** These finite boards commit night deaths before entering the daytime pipeline. */
export function settlesNightBeforeDay(config: ReadonlyBoardConfig): boolean {
  return !!(config.pureWhite || config.evilKnight || config.demonHunter || config.ghostBride);
}
