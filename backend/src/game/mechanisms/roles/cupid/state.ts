import { playerDataField } from "../player_state";
import type { CupidPolicy } from "../../../../core/domain/board";
import type { RoleComponent } from "../../../../core/domain/components/role";
export interface CupidState {
  policy: CupidPolicy;
  remaining: 0 | 1;
  choice: { day: 1; pairIds: [number, number] } | null;
}
export function getCupidState(role: RoleComponent | undefined): CupidState | undefined {
  return role?.privateState.cupid as CupidState | undefined;
}
export function projectCupidState(
  state: CupidState,
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
