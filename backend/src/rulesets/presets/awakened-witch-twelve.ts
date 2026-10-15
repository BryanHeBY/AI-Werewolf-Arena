/**
 * 负责网易原觉醒女巫十二人牌池及AWA明确政策的数据预设。
 * 输入为固定声明，输出独立BoardConfig；不读取World或把配置当作协作/狼爪执行权限。
 */
import {
  ActionWindow,
  Role,
  WinCondition,
  type BoardConfig,
} from "@ai-werewolf-arena/game-contract";
export const awakenedWitchTwelveConfig: BoardConfig = {
  boardSize: 12,
  enableSheriff: true,
  awakenedWitch: { policy: "awa_awakened_witch_v1" },
  awakenedWolfKing: { policy: "awa_awakened_wolf_king_v1" },
  winConditions: [WinCondition.SlaughterSide],
  hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
  selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
  seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
  guard: { repeatPolicy: "awa_last_action_v1" },
  hunter: { deathActionPolicy: "awa_qualified_sources_v1" },
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
    { role: Role.AwakenedWolfKing, count: 1 },
    { role: Role.Villager, count: 4 },
    { role: Role.Seer, count: 1 },
    { role: Role.Guard, count: 1 },
    { role: Role.Hunter, count: 1 },
    { role: Role.AwakenedWitch, count: 1 },
  ],
};
