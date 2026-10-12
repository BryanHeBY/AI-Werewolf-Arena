import { types } from "node:util";
import type { World } from "../../../../core/domain/world";
import { Camp } from "../../../../core/domain/identity";
import { originalPlayerCurrent as pairTargetCurrent } from "../original_player_scope";
import type { OriginalPlayerScope as PairTargetScope } from "../original_player_scope";
export {
  captureOriginalPlayer as capturePairTarget,
  originalPlayerSameLife as pairTargetOriginal,
  originalPlayerCurrent as pairTargetCurrent,
} from "../original_player_scope";
export type { OriginalPlayerScope as PairTargetScope } from "../original_player_scope";

/** Both original identities must be live before producing the sole aggregate boolean. */
export function capturedPairContainsWolf(
  world: World,
  targets: readonly PairTargetScope[],
): boolean | null {
  if (
    types.isProxy(targets) ||
    !Array.isArray(targets) ||
    Object.getPrototypeOf(targets) !== Array.prototype
  )
    return null;
  const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
    targets as object,
  );
  if (
    Reflect.ownKeys(fields).length !== 3 ||
    fields.length?.value !== 2 ||
    !("value" in (fields["0"] ?? {})) ||
    !("value" in (fields["1"] ?? {}))
  )
    return null;
  const first = fields["0"]!.value as PairTargetScope,
    second = fields["1"]!.value as PairTargetScope;
  if (
    !pairTargetCurrent(world, first) ||
    !pairTargetCurrent(world, second) ||
    first.id === second.id
  )
    return null;
  return first.campValue === Camp.Wolf || second.campValue === Camp.Wolf;
}
