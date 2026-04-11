import { BoardConfig, Role, WinCondition } from "../domain/model";

/**
 * 6 人 MVP：最小闭环板子，用于验证基础夜昼流转与守卫/预言家核心规则。
 */
export const sixPlayerMvpConfig: BoardConfig = {
  boardSize: 6,
  revealOnDeath: false,
  enableSheriff: false,
  winConditions: [WinCondition.SlaughterCity, WinCondition.WolfReachHalf],
  hooks: {
    onDaybreak: false,
    onPreElection: false,
    onPreVote: false,
    onPerSpeechGap: false,
  },
  roleSetups: [
    { role: Role.Wolf, count: 2 },
    { role: Role.Villager, count: 2 },
    { role: Role.Seer, count: 1 },
    { role: Role.Guard, count: 1 },
  ],
};
