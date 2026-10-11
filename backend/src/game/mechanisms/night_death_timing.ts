import type { BoardConfig } from "../../core/domain/board";
/** These finite boards commit night deaths before entering the daytime pipeline. */
export function settlesNightBeforeDay(config: BoardConfig): boolean {
  return !!(config.pureWhite || config.evilKnight || config.demonHunter || config.ghostBride);
}
