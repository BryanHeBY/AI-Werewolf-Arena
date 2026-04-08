import { BoardConfig, Role, WinCondition } from "../domain/model";

export const sixPlayerMvpConfig: BoardConfig = {
  boardSize: 6,
  revealOnDeath: false,
  enableSheriff: false,
  winCondition: WinCondition.SlaughterCity,
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
