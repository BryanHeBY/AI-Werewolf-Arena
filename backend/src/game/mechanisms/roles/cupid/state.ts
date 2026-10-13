/**
 * Owns Cupid slot reads and player-state projection. Inputs are the original role record
 * and choice data; outputs retain the live record or the existing detached pair view.
 * This boundary never binds lovers, commits stock or evaluates relationship victory.
 */
import type { CupidReadState } from "@ai-werewolf-arena/game-contract";
import { playerDataField } from "../player_state";

import type { RoleComponent } from "../../../../core/domain/components/role";
export function getCupidState(role: RoleComponent | undefined): CupidReadState | undefined {
  return (role as { readonly privateState: { readonly cupid?: unknown } } | undefined)?.privateState
    .cupid as CupidReadState | undefined;
}
export function projectCupidState(
  state: CupidReadState,
): import("../player_extended_state").PlayerCupidState {
  const policy = playerDataField(state, "policy"),
    choice = playerDataField(state, "choice"),
    pair = playerDataField(choice, "pairIds");
  // Arrays have their own inert data reader; the shared object-state reader
  // deliberately rejects arrays. Never evaluate foreign index accessors.
  const pairField = (key: string): unknown => {
    if (!Array.isArray(pair)) return undefined;
    const field = Object.getOwnPropertyDescriptor(pair, key);
    return field && Object.hasOwn(field, "value") ? field.value : undefined;
  };
  const first = pairField("0"),
    second = pairField("1");
  const positive = (id: unknown): id is number =>
    typeof id === "number" && Number.isSafeInteger(id) && id > 0;
  return {
    policy: policy === "lui_meme_lovers_only_v1" ? policy : "netease_2017_cupid_follows_lovers_v1",
    remaining: playerDataField(state, "remaining") === 1 ? 1 : 0,
    choice:
      playerDataField(choice, "day") === 1 &&
      Array.isArray(pair) &&
      pairField("length") === 2 &&
      positive(first) &&
      positive(second) &&
      first !== second
        ? { day: 1, pairIds: [first, second] }
        : null,
  };
}
