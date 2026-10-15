/**
 * 负责定义玩家观察的完整纯数据结构及原脱离冻结程序。输入为已投影事实、自己的知识 DTO 和请求；
 * 输出保留所有原可选／nullable 字段，先 structuredClone，再按原 Object.values 递归 freeze。
 * 这里不含 World、角色原体或资源写句柄，不安装状态、解析新 schema 或授予行动权限。
 * 捕获方决定知识和候选；该数据契约不把未知阵营或当前许可猜测成已知事实。
 */
import type {
  PlayerHiddenWolfState,
  PlayerGravekeeperState,
  PlayerMechanicalState,
  PlayerAwakenedState,
  PlayerHybridState,
  PlayerBlackMarketState,
  PlayerMerchantState,
} from "@ai-werewolf-arena/game-contract/player-state-views";
import type { ActionRequest, Camp, Role } from "@ai-werewolf-arena/game-contract";
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
} from "@ai-werewolf-arena/game-contract/player-state-views";
import type {
  PlayerNightAbility,
  OwnNightAction,
} from "@ai-werewolf-arena/game-contract/night-ability-views";
import type { PlayerDeathGun } from "@ai-werewolf-arena/game-contract/player-state-views";

/** 玩家决策端口只携带已投影事实和自己的知识，不提供 World。 */
export interface PlayerObservation {
  request: ActionRequest;
  identity: { role?: Role; camp?: Camp; name?: string };
  knownAliveIds: number[];
  teammateIds: number[];
  /** 自己在捕获时点的狼队行动资格；不附权限原因、对手状态或请求 lease，提交时仍重验。 */
  currentWolfActions: { canChat: boolean; canVoteForKill: boolean };
  abilities: PlayerNightAbility[];
  deathAbilities: PlayerDeathGun[];
  ownNightActions: OwnNightAction[];
  ownState: {
    fragrantPhantom?: import("@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer").FragrantPlayerState;
    nightNoble?: import("@ai-werewolf-arena/game-contract/facts/noble-secret-body").NoblePlayerState;
    secretBody?: import("@ai-werewolf-arena/game-contract/facts/noble-secret-body").SecretBodyPlayerState;
    eclipse?: import("@ai-werewolf-arena/game-contract/facts/radiant-eclipse").EclipseState;
    alchemist?: import("@ai-werewolf-arena/game-contract/facts/mist-raven").PlayerAlchemistState;
    ravenClaw?: import("@ai-werewolf-arena/game-contract/facts/mist-raven").PlayerRavenState;
    scholarMentor?: import("@ai-werewolf-arena/game-contract").ModifierState;
    timeConsort?: import("@ai-werewolf-arena/game-contract/facts/time-wolf-consort").PlayerTimeConsortState;
    wolfSorcerer?: import("@ai-werewolf-arena/game-contract").WolfSorcererState;
    trickster?: import("@ai-werewolf-arena/game-contract").TricksterState;
    orderPrince?: import("@ai-werewolf-arena/game-contract/facts/order-prince").OrderPrinceState;
    magician?: import("@ai-werewolf-arena/game-contract").MagicianState;
    redMoon?: import("@ai-werewolf-arena/game-contract").RedMoonState;
    warden?: import("@ai-werewolf-arena/game-contract/facts/warden").WardenKnowledge;
    awakenedClaws?: import("@ai-werewolf-arena/game-contract/facts/awakened-claws").AwakenedClawState;
    silenceElder?: import("@ai-werewolf-arena/game-contract/facts/silence-elder").SilenceElderState;
    crow?: import("@ai-werewolf-arena/game-contract").CrowState;
    nightmare?: import("@ai-werewolf-arena/game-contract").NightmareShadowState;
    evilKnight?: import("@ai-werewolf-arena/game-contract").EvilKnightState;
    demonHunter?: import("@ai-werewolf-arena/game-contract/facts/demon-hunter").DemonHunterState;
    ghostBride?: import("@ai-werewolf-arena/game-contract/facts/ghost-bride").GhostBrideState;
    wedding?: import("@ai-werewolf-arena/game-contract/facts/ghost-bride").WeddingActorView;
    lonelyGirl?: import("@ai-werewolf-arena/game-contract").LonelyGirlState;
    wildChild?: import("@ai-werewolf-arena/game-contract").WildChildState;
    thief?: import("@ai-werewolf-arena/game-contract").ThiefState & {
      required?: boolean;
      cards?: Array<{ slot: 0 | 1; role: Role }>;
    };
    shapeshifter?: import("@ai-werewolf-arena/game-contract").ShapeshifterState & {
      mustChoose?: boolean;
      allowedSlots?: Array<0 | 1>;
      cards?: Array<{ slot: 0 | 1; role: Role }>;
    };
    wallNote?: import("@ai-werewolf-arena/game-contract/facts/wall-notes").WallNoteComponent & {
      effectiveRemaining: 0 | 1;
    };
    blackMarket?: PlayerBlackMarketState;
    awakened?: PlayerAwakenedState;
    hybrid?: PlayerHybridState;
    debater?: {
      policy: import("../../domain/board").DebaterPolicy;
      remaining: 0 | 1;
      choice: { day: number; targetId: number } | null;
    };
    debatePenalty?: { day: number };
    cupid?: import("@ai-werewolf-arena/game-contract/player-state-views").PlayerCupidState;
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
    foxCub?: { remaining: 0 | 1; lastChoice: { day: number; targetId: number | null } | null };
    pufferfish?: { remaining: 0 | 1; lastDecision: { day: number; activate: boolean } | null };
    whiteCat?: { revealed: boolean };
    hiddenWolf?: PlayerHiddenWolfState;
    gargoyle?: { hasInheritedKnife: boolean; canVoteForKill: boolean };
    roleInspection?: PlayerRoleInspectionState;
    idiot?: PlayerIdiotState;
    seer?: PlayerSeerState;
  };
}

export interface ObservedPlayerStrategy {
  decide(
    observation: PlayerObservation,
  ): Promise<import("@ai-werewolf-arena/game-contract").ToolCall | null>;
}

/** 先复制再递归冻结，避免策略修改引擎或污染后续观察；保持原接受集合和失败顺序。 */
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
