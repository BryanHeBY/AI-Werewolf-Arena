import { ActionWindow, BoardConfig, Role, WinCondition } from "../core/domain/model";

/**
 * 12 人标准局：用于验证警长系统、白痴/猎人钩子与白天中断链路。
 */
export const twelvePlayerStandardConfig: BoardConfig = {
  boardSize: 12,
  revealOnDeath: true,
  enableSheriff: true,
  winConditions: [WinCondition.SlaughterSide, WinCondition.WolfReachHalf],
  hooks: {
    onDaybreak: true,
    onPreElection: true,
    onPreVote: true,
    onPerSpeechGap: true,
  },
  selfDestruct: {
    enabledWindows: [ActionWindow.OnPreVote],
  },
  roleSetups: [
    { role: Role.Wolf, count: 4 },
    { role: Role.Villager, count: 4 },
    { role: Role.Seer, count: 1 },
    { role: Role.Witch, count: 1 },
    { role: Role.Hunter, count: 1 },
    { role: Role.Idiot, count: 1 },
  ],
};
