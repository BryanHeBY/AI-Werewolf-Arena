/**
 * 负责向运行装配及场景调用方提供既有板子预设。
 * 固定寻香魅影／觉醒预言家十二人牌组，声明守卫重复和猎人合格来源政策。
 * 输入为本模块固定声明，输出为原 BoardConfig 数据；不在此解析、验证或冻结配置。
 * 预设不代表任意角色组合受支持，也不创建 World、支付资源或授予行动权限；规范化与有限支持由调用方继续执行。
 */
import {
  Role,
  WinCondition,
  WitchSelfHealRule,
  ActionWindow,
  type BoardConfig,
} from "../../domain/model";
export const fragrantPairSeerTwelveConfig: BoardConfig = {
  boardSize: 12,
  enableSheriff: true,
  fragrantPairSeer: { policy: "awa_fragrant_pair_seer_v1" },
  winConditions: [WinCondition.SlaughterSide],
  guard: { repeatPolicy: "netease_consecutive_nights_v1" },
  hunter: { deathActionPolicy: "awa_qualified_sources_v1" },
  witch: {
    canSelfHeal: WitchSelfHealRule.Disabled,
    knifeVisibility: "awa_with_heal_v1",
    potionPolicy: "awa_one_native_v1",
  },
  hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
  selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
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
    { role: Role.FragrantPhantom, count: 1 },
    { role: Role.Wolf, count: 3 },
    { role: Role.Villager, count: 4 },
    { role: Role.AwakenedSeer, count: 1 },
    { role: Role.Witch, count: 1 },
    { role: Role.Hunter, count: 1 },
    { role: Role.Guard, count: 1 },
  ],
};
