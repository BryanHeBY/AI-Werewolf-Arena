/**
 * 负责网易暗夜星辰原十／十二人固定牌池的数据预设，AWA选择屠边、首波遗言及一次PK。
 * 输入只有实际人数，输出相互独立的纯配置；不创建角色库存、查询World或放宽其它高级合板支持。
 */
import {
  ActionWindow,
  Role,
  WinCondition,
  WitchSelfHealRule,
  type BoardConfig,
} from "@ai-werewolf-arena/game-contract";
function config(size: 10 | 12): BoardConfig {
  return {
    boardSize: size,
    enableSheriff: true,
    awakenedWolfBeauty: { policy: "awa_awakened_replacement_v1" },
    awakenedHunter: { policy: "awa_directional_patrol_v1" },
    winConditions: [WinCondition.SlaughterSide],
    hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    guard: { repeatPolicy: "awa_last_action_v1" },
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
      { role: Role.Wolf, count: size === 10 ? 2 : 3 },
      { role: Role.AwakenedWolfBeauty, count: 1 },
      { role: Role.Villager, count: size === 10 ? 3 : 4 },
      { role: Role.Seer, count: 1 },
      { role: Role.Witch, count: 1 },
      { role: Role.Guard, count: 1 },
      { role: Role.AwakenedHunter, count: 1 },
    ],
  };
}
export const awakenedDarkStarsTenConfig = config(10);
export const awakenedDarkStarsTwelveConfig = config(12);
