/**
 * Exposes Mist/Raven's public circle query and concrete night ownership ports.
 * Inputs are bound target queries or original lifecycle World/day/event reads;
 * outputs are current circle IDs, roster assertions, the opening/cleanup unit
 * and terminal port. Board predicates retain original readability errors.
 * Target binding never reads a frame, life, clock or random source, and its
 * read-only result grants no state or commit method. Lifecycle calls retain
 * original publication, late transfer and abort timing; frame authority alone
 * owns paid choices, roster failures and closed-night rules.
 */
import type { EntityId } from "../../../../core/domain/identity";
import type { World } from "../../../../core/domain/world";
import { isMistRavenBoard, mistKnifeTargets } from "./night_frame";
export { MistNightUnit, mistNightTerminal } from "./night-lifecycle";
export type { MistNightRuntime } from "./night-lifecycle";
export { isMistRavenBoard, mistKnifeTargets, assertMistRosterCurrent } from "./night_frame";

export interface MistKnifeTargetQuery {
  targets(): readonly EntityId[] | null;
}

export function bindMistKnifeTargetQuery(world: World): MistKnifeTargetQuery {
  return Object.freeze({
    targets: () => (isMistRavenBoard(world) ? mistKnifeTargets(world) : null),
  });
}
