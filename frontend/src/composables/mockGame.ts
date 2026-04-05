import {
  GamePhase,
  Faction,
  RoleType,
  ActionType,
  PublicPlayer,
  PlayerAction,
  NightResult,
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

function generateGameHistory(players: PublicPlayer[]): PlayerAction[] {
  const events: PlayerAction[] = [];
  const now = Date.now();

  // Night events
  const wolf = players.find((p) => p.roleType === RoleType.Wolf);
  if (wolf) {
    events.push({
      playerId: wolf.id,
      actionType: ActionType.Kill,
      targetId: players.find((p) => p.faction === Faction.Villager)!.id,
      thought:
        "I think this player might be the seer based on their behavior yesterday",
      timestamp: now - 5000,
    });
  }

  // Seer actions - 注意：这里的 players 数组没有 roleType 属性
  // 暂时使用其他方式查找预言家
  if (players.length > 1) {
    const targetPlayer = players[1]; // 假设第二个玩家是目标
    events.push({
      playerId: targetPlayer.id,
      actionType: ActionType.Check,
      targetId: players[0].id,
      privateThought: "I suspect this player may be a werewolf",
      timestamp: now - 4000,
    });
  }

  // Witch actions - 注意：这里的 players 数组没有 roleType 属性
  // 暂时使用其他方式模拟女巫行动
  if (players.length > 2) {
    events.push({
      playerId: players[2].id,
      actionType: ActionType.Save,
      targetId: players[0].id,
      privateThought: "This player seems valuable to the village",
      timestamp: now - 3000,
    });
  }

  // Day talk/death events - 模拟玩家死亡事件
  // 注意：这里只是模拟数据，实际的 PlayerAction 接口没有 type 属性
  if (players.length > 0) {
    const deadPlayerIndex = Math.floor(Math.random() * players.length);
    events.push({
      playerId: players[deadPlayerIndex].id,
      actionType: ActionType.Kill, // 使用 Kill 作为死亡动作类型
      targetId: null,
      privateThought: "Player died during the night",
      timestamp: now - 2000,
    });
  }

  return events;
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
