import type { ActionRequest, Camp, Role } from "../../../core";
import type { GuardState, HunterState, WolfKingState, WhiteWolfKingState, KnightState, GravekeeperState, DreamerState, WolfBeautyState, BearState, IdiotState, SeerState, WitchState } from "../../../game/mechanisms/roles/private_state";
import type { PlayerNightAbility } from "../../../game/mechanisms/roles/abilities";
import type { PlayerDeathGun } from "../../../game/mechanisms/roles/death_abilities";
import type { MechanicalState } from "../../../game/mechanisms/roles/mechanical_wolf/state";
import type { AwakenedState } from "../../../game/mechanisms/roles/awakened_hidden_wolf/state";
import type { OwnNightAction } from "../../../game/mechanisms/roles/night_action_history";
import type { HybridState } from "../../../game/mechanisms/roles/hybrid/state";
import type { BlackMarketState } from "../../../game/mechanisms/roles/black_market_merchant/state";
import type { MerchantState } from "../../../game/mechanisms/roles/miracle_merchant/state";

/** A player decision port: projected facts and their own state, with no world access. */
export interface PlayerObservation {
  request: ActionRequest;
  identity: { role?: Role; camp?: Camp; name?: string };
  knownAliveIds: number[];
  teammateIds: number[];
  abilities: PlayerNightAbility[];
  deathAbilities: PlayerDeathGun[];
  ownNightActions: OwnNightAction[];
  ownState: { blackMarket?: BlackMarketState; awakened?: AwakenedState; hybrid?: HybridState; merchant?: MerchantState; mechanical?: MechanicalState; witch?: WitchState; guard?: GuardState; hunter?: HunterState; wolfKing?: WolfKingState; whiteWolfKing?: WhiteWolfKingState; knight?: KnightState; gravekeeper?: GravekeeperState; dreamer?: DreamerState; wolfBeauty?: WolfBeautyState; bear?:BearState; hiddenWolf?:{hasInheritedKnife:boolean;canVoteForKill:boolean}; gargoyle?:{hasInheritedKnife:boolean;canVoteForKill:boolean};roleInspection?:import("../../../game/mechanisms/roles/private_state").RoleInspectionState; idiot?: IdiotState; seer?: SeerState };
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
