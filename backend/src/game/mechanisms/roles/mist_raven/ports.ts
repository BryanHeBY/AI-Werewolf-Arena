/**
 * Owns the public read-only ordinary knife circle contribution for Mist/Raven.
 * Inputs are target queries bound to the original World; outputs are current
 * circle IDs or null. When queried, original roster failures propagate and
 * absent/closed circles retain null. Binding never reads a frame, life, clock
 * or random source and consumers receive no state, World or commit method.
 */
import type { EntityId } from "../../../../core/domain/identity";
import type { World } from "../../../../core/domain/world";
import { isMistRavenBoard, mistKnifeTargets } from "./night_frame";

export interface MistKnifeTargetQuery {
  targets(): readonly EntityId[] | null;
}

export function bindMistKnifeTargetQuery(world: World): MistKnifeTargetQuery {
  return Object.freeze({
    targets: () => (isMistRavenBoard(world) ? mistKnifeTargets(world) : null),
  });
}
