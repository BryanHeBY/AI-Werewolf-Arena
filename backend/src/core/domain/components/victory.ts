import type { VictoryAffiliation } from "@ai-werewolf-arena/game-catalog";
import { readVictoryAffiliations } from "@ai-werewolf-arena/replay-contract";

/** Owned win membership; deliberately separate from Role.camp and abilities. */
export interface VictoryComponent {
  affiliations: VictoryAffiliation[];
}
export function createVictoryComponent(
  affiliations: readonly VictoryAffiliation[],
): VictoryComponent {
  return { affiliations: readVictoryAffiliations(affiliations) };
}
