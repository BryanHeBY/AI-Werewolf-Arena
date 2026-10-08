import type { ActionRequest, Camp, Role } from "../../../core";
import type { GuardState, HunterState, WolfKingState, WhiteWolfKingState, IdiotState, SeerState, WitchState } from "../../../game/mechanisms/roles/private_state";
import type { PlayerNightAbility } from "../../../game/mechanisms/roles/abilities";

/** A player decision port: projected facts and their own state, with no world access. */
export interface PlayerObservation {
  request: ActionRequest;
  identity: { role?: Role; camp?: Camp; name?: string };
  knownAliveIds: number[];
  teammateIds: number[];
  abilities: PlayerNightAbility[];
  ownState: { witch?: WitchState; guard?: GuardState; hunter?: HunterState; wolfKing?: WolfKingState; whiteWolfKing?: WhiteWolfKingState; idiot?: IdiotState; seer?: SeerState };
}

export interface ObservedPlayerStrategy {
  decide(observation: PlayerObservation): Promise<import("../../../core").ToolCall | null>;
}

/** Freeze a detached DTO so strategy code cannot mutate the engine or later observations. */
export function freezeObservation(observation: PlayerObservation): PlayerObservation {
  const result = structuredClone(observation);
  const freeze = (value: unknown) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  };
  freeze(result);
  return result;
}
