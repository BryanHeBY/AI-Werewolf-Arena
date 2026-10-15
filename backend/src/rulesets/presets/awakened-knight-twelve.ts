/**
 * 负责网易觉醒骑士原十二人牌池与具名AWA时序政策的纯预设。输入固定公开声明，输出独立BoardConfig。
 * 全牌依赖觉醒狼美人／守卫；配置不授边界、替死、死亡或延期遗言权限，禁止拿普通角色替换冒充原板。
 */
import {
  ActionWindow,
  Role,
  WinCondition,
  WitchSelfHealRule,
  type BoardConfig,
} from "@ai-werewolf-arena/game-contract";
export const awakenedKnightTwelveConfig: BoardConfig = {
  boardSize: 12,
  enableSheriff: true,
  winConditions: [WinCondition.SlaughterSide],
  awakenedWolfBeauty: { policy: "awa_awakened_replacement_v1" },
  awakenedGuard: { policy: "awa_awakened_guard_cycle_v1" },
  awakenedKnight: { policy: "awa_awakened_duel_chain_v1" },
  hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
  selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
  seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
  witch: {
    canSelfHeal: WitchSelfHealRule.Disabled,
    knifeVisibility: "awa_with_heal_v1",
    potionPolicy: "awa_one_native_v1",
  },
  sheriff: {
    electionPolicy: "awa_nomination_offstage_pk_v1",
    badgePolicy: "awa_holder_choice_v1",
    voteWeight: 1.5,
  },
  tieBreaker: {
    sheriffVote: "no_elimination",
    wolfKillVote: "min_id",
    exileVote: "no_elimination",
  },
  voting: { exilePolicy: "awa_one_pk_v1" },
  disclosure: { deathRevealPolicy: "awa_hidden_v1" },
  lastWords: { policy: "awa_initial_wave_v1" },
  roleSetups: [
    { role: Role.Wolf, count: 3 },
    { role: Role.AwakenedWolfBeauty, count: 1 },
    { role: Role.Villager, count: 4 },
    { role: Role.Seer, count: 1 },
    { role: Role.Witch, count: 1 },
    { role: Role.AwakenedGuard, count: 1 },
    { role: Role.AwakenedKnight, count: 1 },
  ],
};
