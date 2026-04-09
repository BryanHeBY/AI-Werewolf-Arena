import { 
  GamePhase, 
  Faction, 
  RoleType, 
  ActionType, 
  PublicPlayer, 
  PlayerAction,
  NightResult,
  BroadcastEventType,
  PublicGameState
} from '@/types'

const playerNames = [
  'Z3R0', 'N3XUS', 'CYBR', 'AURA', 'S1R4N',
  'CRYPTO', 'P1X3L', 'R0GUE', 'PH4NTOM', 'N3RO'
]

/**
 * 原地洗牌：用于打乱 mock 玩家顺序，避免固定座位导致展示单一。
 */
function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * 构造一局前端演示用的初始状态。
 */
export function getMockGame(): PublicGameState {
  // Create players
  const players: PublicPlayer[] = playerNames.map((name, index) => ({
    id: index + 1,
    name,
    roleType: index === 0 ? RoleType.Werewolf 
               : index === 1 ? RoleType.Seer
               : index === 2 ? RoleType.Witch
               : Math.random() > 0.3 ? RoleType.Villager : RoleType.Werewolf,
    faction: index === 0 || (index >= 3 && Math.random() > 0.6) ? Faction.Wolf : Faction.Villager,
    isAlive: true
  }))

  shuffleArray(players)

  return {
    phase: GamePhase.NightStart,
    round: 1,
    players,
    deadPlayerIds: [],
    history: generateGameHistory(players),
    witchHasAntidote: true,
    witchHasPoison: true,
    currentSpeechIndex: 0
  }
}

/**
 * 生成一段可视化历史记录，便于日志组件在 mock 模式下展示。
 */
function generateGameHistory(players: PublicPlayer[]): PlayerAction[] {
  const events: PlayerAction[] = []
  const now = Date.now()

  // Night events
  events.push({
    playerId: players.find(p => p.roleType === RoleType.Wolf)!.id,
    roleType: RoleType.Wolf,
    actionType: ActionType.Kill,
    targetId: players.find(p => p.faction === Faction.Good)!.id,
    thought: 'I think this player might be the seer based on their behavior yesterday',
    timestamp: now - 5000
  })

  // Seer actions
  const seer = players.find(p => p.roleType === RoleType.Seer)
  if (seer) {
    events.push({
      playerId: seer.id,
      roleType: RoleType.Seer,
      actionType: ActionType.Check,
      targetId: players.find(p => p.id !== seer.id)!.id,
      thought: 'I suspect this player may be a werewolf',
      timestamp: now - 4000
    })
  }

  // Witch actions
  const witch = players.find(p => p.roleType === RoleType.Witch)
  if (witch) {
    events.push({
      playerId: witch.id,
      roleType: RoleType.Witch,
      actionType: ActionType.Save,
      targetId: players.find(p => p.id !== witch.id)!.id,
      thought: 'This player seems valuable to the village',
      timestamp: now - 3000
    })
  }

  // Day talk/death events
  events.push({
    type: BroadcastEventType.PlayerDied,
    playerId: players[Math.floor(Math.random() * players.length)].id,
    roleType: RoleType.Villager,
    actionType: ActionType.NoAction,
    thought: 'Player died during the night',
    timestamp: now - 2000
  })

  return events
}

/**
 * 将 mock 状态机推进到下一个阶段，供“下一步”按钮触发。
 */
export function simulateGameTick(gameState: PublicGameState): PublicGameState {
  return {
    ...gameState,
    phase: gameState.phase === GamePhase.NightStart ? GamePhase.WolfAction : 
           gameState.phase === GamePhase.WolfAction ? GamePhase.SeerAction :
           gameState.phase === GamePhase.SeerAction ? GamePhase.WitchAction : GamePhase.DayStart
  }
}
