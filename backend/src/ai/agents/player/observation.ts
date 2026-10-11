import type {
  PlayerHiddenWolfState,
  PlayerGravekeeperState,
  PlayerMechanicalState,
  PlayerAwakenedState,
  PlayerHybridState,
  PlayerBlackMarketState,
  PlayerMerchantState,
} from "../../../game/mechanisms/roles/player_extended_state";
import type { ActionRequest, Camp, Role } from "../../../core";
import type {
  PlayerGuardState,
  PlayerHunterState,
  PlayerWolfKingState,
  PlayerWhiteWolfKingState,
  PlayerKnightState,
  PlayerDreamerState,
  PlayerWolfBeautyState,
  PlayerBearState,
  PlayerIdiotState,
  PlayerSeerState,
  PlayerWitchState,
  PlayerRoleInspectionState,
} from "../../../game/mechanisms/roles/player_state";
import type { PlayerNightAbility } from "../../../game/mechanisms/roles/abilities";
import type { PlayerDeathGun } from "../../../game/mechanisms/roles/death_abilities";
import type { OwnNightAction } from "../../../game/mechanisms/roles/night_action_history";

/** A player decision port: projected facts and their own state, with no world access. */
export interface PlayerObservation {
  request: ActionRequest;
  identity: { role?: Role; camp?: Camp; name?: string };
  knownAliveIds: number[];
  teammateIds: number[];
  abilities: PlayerNightAbility[];
  deathAbilities: PlayerDeathGun[];
  ownNightActions: OwnNightAction[];
  ownState: {
    scholarMentor?: import("../../../game/mechanisms/roles/scholar_mentor/state").ModifierState;
    timeConsort?: NonNullable<
      ReturnType<
        typeof import("../../../game/mechanisms/roles/time_wolf_consort/state").projectTimeConsortState
      >
    >;
    wolfSorcerer?: import("../../../game/mechanisms/roles/wolf_sorcerer/state").WolfSorcererState;
    trickster?: import("../../../game/mechanisms/roles/trickster/state").TricksterState;
    orderPrince?: import("../../../game/mechanisms/roles/order_prince/state").OrderPrinceState;
    magician?: import("../../../game/mechanisms/roles/magician/state").MagicianState;
    redMoon?: import("../../../game/mechanisms/roles/red_moon_apostle/state").RedMoonState;
    nightmare?: import("../../../game/mechanisms/roles/nightmare_shadow/state").NightmareShadowState;
    evilKnight?: import("../../../game/mechanisms/roles/evil_knight/state").EvilKnightState;
    demonHunter?: import("../../../game/mechanisms/roles/demon_hunter/state").DemonHunterState;
    ghostBride?: import("@ai-werewolf-arena/game-text").GhostBrideState;
    wedding?: import("../../../game/mechanisms/roles/ghost_bride/authority").WeddingActorView;
    lonelyGirl?: import("../../../game/mechanisms/roles/lonely_girl/state").LonelyGirlState;
    wildChild?: import("../../../game/mechanisms/roles/wild_child/state").WildChildState;
    thief?: import("../../../game/mechanisms/roles/thief/state").ThiefState & {
      required?: boolean;
      cards?: Array<{ slot: 0 | 1; role: Role }>;
    };
    shapeshifter?: import("../../../game/mechanisms/roles/shapeshifter/state").ShapeshifterState & {
      mustChoose?: boolean;
      allowedSlots?: Array<0 | 1>;
      cards?: Array<{ slot: 0 | 1; role: Role }>;
    };
    wallNote?: import("../../../core/domain/components/wall_note").WallNoteComponent & {
      effectiveRemaining: 0 | 1;
    };
    blackMarket?: PlayerBlackMarketState;
    awakened?: PlayerAwakenedState;
    hybrid?: PlayerHybridState;
    debater?: {
      policy: import("../../../core/domain/board").DebaterPolicy;
      remaining: 0 | 1;
      choice: { day: number; targetId: number } | null;
    };
    debatePenalty?: { day: number };
    cupid?: import("../../../game/mechanisms/roles/player_extended_state").PlayerCupidState;
    lover?: { partnerId: number; mayNotVotePartner: boolean };
    merchant?: PlayerMerchantState;
    mechanical?: PlayerMechanicalState;
    witch?: PlayerWitchState;
    guard?: PlayerGuardState;
    hunter?: PlayerHunterState;
    wolfKing?: PlayerWolfKingState;
    whiteWolfKing?: PlayerWhiteWolfKingState;
    knight?: PlayerKnightState;
    gravekeeper?: PlayerGravekeeperState;
    dreamer?: PlayerDreamerState;
    wolfBeauty?: PlayerWolfBeautyState;
    bear?: PlayerBearState;
    hiddenWolf?: PlayerHiddenWolfState;
    gargoyle?: { hasInheritedKnife: boolean; canVoteForKill: boolean };
    roleInspection?: PlayerRoleInspectionState;
    idiot?: PlayerIdiotState;
    seer?: PlayerSeerState;
  };
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
