import { BoardConfig, Role, WinCondition } from "../domain/model";

export const twelvePlayerStandardConfig: BoardConfig = {
  boardSize: 12,
  revealOnDeath: true,
  enableSheriff: true,
  initialSheriffSeat: 1,
  winCondition: WinCondition.SlaughterSide,
  hooks: {
    onDaybreak: true,
    onPreElection: false,
    onPreVote: true,
    onPerSpeechGap: true,
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
