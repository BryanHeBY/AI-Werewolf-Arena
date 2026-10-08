import type { ActionRequest, Camp, Role } from "../../../core";
import type { GuardState, HunterState, WolfKingState, WhiteWolfKingState, KnightState, GravekeeperState, DreamerState, WolfBeautyState, BearState, IdiotState, SeerState, WitchState } from "../../../game/mechanisms/roles/private_state";
import type { PlayerNightAbility } from "../../../game/mechanisms/roles/abilities";
import type { MechanicalState } from "../../../game/mechanisms/roles/mechanical_wolf/state";

/** A player decision port: projected facts and their own state, with no world access. */
export interface PlayerObservation {
  request: ActionRequest;
  identity: { role?: Role; camp?: Camp; name?: string };
  knownAliveIds: number[];
  teammateIds: number[];
  abilities: PlayerNightAbility[];
  ownState: { mechanical?: MechanicalState; witch?: WitchState; guard?: GuardState; hunter?: HunterState; wolfKing?: WolfKingState; whiteWolfKing?: WhiteWolfKingState; knight?: KnightState; gravekeeper?: GravekeeperState; dreamer?: DreamerState; wolfBeauty?: WolfBeautyState; bear?:BearState; hiddenWolf?:{hasInheritedKnife:boolean;canVoteForKill:boolean}; gargoyle?:{hasInheritedKnife:boolean;canVoteForKill:boolean};roleInspection?:import("../../../game/mechanisms/roles/private_state").RoleInspectionState; idiot?: IdiotState; seer?: SeerState };
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
