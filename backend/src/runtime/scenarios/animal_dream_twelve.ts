/**
 * 负责向运行装配及场景调用方提供既有板子预设。
 * 固定动物梦境十二人牌组，白猫等待实际放逐、河豚按最终票与熊的黎明信号一起声明。
 * 输入为本模块固定声明，输出为原 BoardConfig 数据；不在此解析、验证或冻结配置。
 * 预设不代表任意角色组合受支持，也不创建 World、支付资源或授予行动权限；规范化与有限支持由调用方继续执行。
 */
import type { BoardConfig } from "../../core/domain/board";
export const animalDreamTwelveConfig = {
  boardSize: 12,
  enableSheriff: true,
  animalDream: { policy: "awa_animal_dream_v1", eliminationPriority: "awa_wolf_priority_v1" },
  whiteCat: { skippedVotePolicy: "awa_wait_for_actual_exile_v1" },
  pufferfish: { ballotPolicy: "awa_final_ballot_v1" },
  bear: { signalPolicy: "netease_dawn_live_v1" },
  wolfBeauty: { deathLinkPolicy: "awa_exile_poison_v1" },
  roleSetups: [
    { role: "wolf", count: 3 },
    { role: "wolf_beauty", count: 1 },
    { role: "villager", count: 4 },
    { role: "white_cat", count: 1 },
    { role: "fox_cub", count: 1 },
    { role: "bear", count: 1 },
    { role: "pufferfish", count: 1 },
  ],
  winConditions: ["slaughter_side"],
  hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
  selfDestruct: { enabledWindows: ["on_pre_election", "on_pre_vote"] },
  tieBreaker: {
    sheriffVote: "no_elimination",
    wolfKillVote: "min_id",
    exileVote: "no_elimination",
  },
  voting: { exilePolicy: "awa_one_pk_v1" },
  disclosure: { deathRevealPolicy: "awa_hidden_v1" },
  lastWords: { policy: "awa_initial_wave_v1" },
  sheriff: {
    electionPolicy: "awa_nomination_offstage_pk_v1",
    badgePolicy: "awa_holder_choice_v1",
    voteWeight: 1.5,
  },
} as unknown as BoardConfig;
