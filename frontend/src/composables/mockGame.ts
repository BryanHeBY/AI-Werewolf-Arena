import {
  GamePhase,
  Faction,
  RoleType,
  PublicPlayer,
  PublicGameState,
} from "@/types";

const playerNames = [
  "Z3R0",
  "N3XUS",
  "CYBR",
  "AURA",
  "S1R4N",
  "CRYPTO",
  "P1X3L",
  "R0GUE",
  "PH4NTOM",
  "N3RO",
];

function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function getMockGame(): PublicGameState {
  // Create players
  const players: PublicPlayer[] = playerNames.map((name, index) => ({
    id: index + 1,
    name,
    roleType:
      index === 0
        ? RoleType.Wolf
        : index === 1
          ? RoleType.Seer
          : index === 2
            ? RoleType.Witch
            : Math.random() > 0.3
              ? RoleType.Villager
              : RoleType.Wolf,
    faction:
      index === 0 || (index >= 3 && Math.random() > 0.6)
        ? Faction.Wolf
        : Faction.Villager,
    isAlive: true,
  }));

  shuffleArray(players);

  return {
    phase: GamePhase.Night_Start,
    round: 1,
    alivePlayers: players,
    deadPlayers: [],
    nightResult: null,
    voteResult: null,
    wolfCount: players.filter((p) => p.roleType === RoleType.Wolf).length,
    villagerCount: players.filter(
      (p) =>
        p.roleType === RoleType.Villager ||
        p.roleType === RoleType.Seer ||
        p.roleType === RoleType.Witch,
    ).length,
    isGameOver: false,
    winner: null,
  };
}

export function simulateGameTick(gameState: PublicGameState): PublicGameState {
  return {
    ...gameState,
    phase:
      gameState.phase === GamePhase.Night_Start
        ? GamePhase.Wolf_Action
        : gameState.phase === GamePhase.Wolf_Action
          ? GamePhase.Seer_Action
          : gameState.phase === GamePhase.Seer_Action
            ? GamePhase.Witch_Action
            : GamePhase.Day_Start,
  };
}
