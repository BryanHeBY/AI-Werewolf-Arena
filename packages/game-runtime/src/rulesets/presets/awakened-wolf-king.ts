/**
 * 负责声明网易原十／十二人觉醒狼王有限牌池。输入为本模块固定人数，输出独立板子数据。
 * 十人女巫首夜自救，十二人不自救且梦保护按夜源传播；未来觉醒女巫合板在其交付前不开放。
 * 预设只声明数据，不给库存、原生命或模型行动授权，实际装配仍经过公共有限支持检查。
 */
import {
  ActionWindow,
  Role,
  WinCondition,
  WitchSelfHealRule,
  type BoardConfig,
} from "@ai-werewolf-arena/game-contract";
function originalBoard(size: 10 | 12): BoardConfig {
  return {
    boardSize: size,
    enableSheriff: true,
    awakenedWolfKing: { policy: "awa_awakened_wolf_king_v1" },
    winConditions: [WinCondition.SlaughterSide],
    hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    witch: {
      canSelfHeal: size === 10 ? WitchSelfHealRule.FirstNightOnly : WitchSelfHealRule.Disabled,
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    ...(size === 12 ? { dreamer: { protectionPolicy: "awa_night_damage_v1" as const } } : {}),
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
      { role: Role.Wolf, count: size === 10 ? 2 : 3 },
      { role: Role.AwakenedWolfKing, count: 1 },
      { role: Role.Villager, count: 4 },
      { role: Role.Seer, count: 1 },
      { role: Role.Witch, count: 1 },
      { role: Role.MiracleMerchant, count: 1 },
      ...(size === 12 ? [{ role: Role.Dreamer, count: 1 }] : []),
    ],
  };
}
export const awakenedWolfKingTenConfig = originalBoard(10);
export const awakenedWolfKingTwelveConfig = originalBoard(12);
