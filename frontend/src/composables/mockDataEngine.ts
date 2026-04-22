
/**
 * Mock 事件引擎：按时间序列回放一局示例狼人杀事件流。
 */
import type { PublicGameState, PlayerAction, BroadcastEvent, GamePhase, RoleType, Faction, ActionType } from '@/types'

const ROLES: RoleType[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager']
const PLAYER_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta']

interface MockEvent {
  type: string
  data: any
  thought?: string
  playerId?: number
  delay: number
}

/**
 * 前端本地演示引擎，模拟后端广播并驱动 UI 变化。
 */
export class MockDataEngine {
  private events: MockEvent[] = []
  private currentIndex = 0
  private isPlaying = false
  private isPaused = false
  private timer: NodeJS.Timeout | null = null
  private callbacks: Map<string, (data: any) => void> = new Map()

  constructor() {
    this.generateGame()
  }

  private generateGame() {
    this.events = []

    this.events.push({
      type: 'game_started',
      data: {
        phase: 'Night_Start' as GamePhase,
        round: 1,
        players: this.createInitialPlayers(),
        deadPlayerIds: [],
        history: [],
        witchHasAntidote: true,
        witchHasPoison: true,
        currentSpeechIndex: 0
      },
      delay: 1000
    })

    this.events.push({
      type: 'agent_thinking',
      playerId: 1,
      thought: "I'm a wolf. Need to coordinate with my partner and eliminate a threat tonight.",
      data: { playerId: 1 },
      delay: 2000
    })

    this.events.push({
      type: 'agent_thinking',
      playerId: 2,
      thought: "I'm a wolf too. Let's work together. Player 3 looks dangerous.",
      data: { playerId: 2 },
      delay: 2000
    })

    this.events.push({
      type: 'player_action',
      playerId: 1,
      thought: "I'll attack player 5 tonight. They seem suspicious.",
      data: {
        playerId: 1,
        roleType: 'wolf' as RoleType,
        actionType: 'kill' as ActionType,
        targetId: 5,
        content: undefined,
        thought: "I'll attack player 5 tonight. They seem suspicious.",
        timestamp: Date.now()
      },
      delay: 1500
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Wolf_Action' as GamePhase,
        round: 1
      },
      delay: 1000
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Seer_Action' as GamePhase,
        round: 1
      },
      delay: 1000
    })

    this.events.push({
      type: 'agent_thinking',
      playerId: 3,
      thought: "I'm the seer. Need to check someone to find wolves. Let me check player 1.",
      data: { playerId: 3 },
      delay: 2000
    })

    this.events.push({
      type: 'player_action',
      playerId: 3,
      thought: "Checking player 1 to determine if they're a wolf...",
      data: {
        playerId: 3,
        roleType: 'seer' as RoleType,
        actionType: 'check' as ActionType,
        targetId: 1,
        content: undefined,
        thought: "Checking player 1 to determine if they're a wolf...",
        timestamp: Date.now()
      },
      delay: 1500
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Witch_Action' as GamePhase,
        round: 1
      },
      delay: 1000
    })

    this.events.push({
      type: 'agent_thinking',
      playerId: 4,
      thought: "I'm the witch. Someone was attacked tonight. Should I save them or use poison?",
      data: { playerId: 4 },
      delay: 2000
    })

    this.events.push({
      type: 'player_action',
      playerId: 4,
      thought: "I'll save player 5 with my antidote tonight.",
      data: {
        playerId: 4,
        roleType: 'witch' as RoleType,
        actionType: 'save' as ActionType,
        targetId: 5,
        content: undefined,
        thought: "I'll save player 5 with my antidote tonight.",
        timestamp: Date.now()
      },
      delay: 1500
    })

    this.events.push({
      type: 'night_result',
      data: {
        deadPlayerIds: [],
        killedByWolf: 5,
        savedByWitch: 5
      },
      delay: 1000
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Day_Start' as GamePhase,
        round: 1
      },
      delay: 1000
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Sequential_Speech' as GamePhase,
        round: 1
      },
      delay: 1000
    })

    for (let i = 0; i < 6; i++) {
      const player = i + 1
      this.events.push({
        type: 'speech_start',
        playerId: player,
        thought: `Player ${player} preparing to speak...`,
        data: { playerId: player, index: i },
        delay: 1500
      })

      this.events.push({
        type: 'agent_thinking',
        playerId: player,
        thought: this.generateThought(player),
        data: { playerId: player },
        delay: 2000
      })

      this.events.push({
        type: 'player_action',
        playerId: player,
        thought: this.generateThought(player),
        data: {
          playerId: player,
          roleType: ROLES[i],
          actionType: 'speak' as ActionType,
          content: this.generateSpeech(player),
          thought: this.generateThought(player),
          timestamp: Date.now()
        },
        delay: 2500
      })
    }

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Vote' as GamePhase,
        round: 1
      },
      delay: 1000
    })

    this.events.push({
      type: 'vote_result',
      data: {
        votes: [
          { voterId: 1, targetId: 3 },
          { voterId: 2, targetId: 3 },
          { voterId: 3, targetId: 1 },
          { voterId: 4, targetId: 3 },
          { voterId: 5, targetId: 1 },
          { voterId: 6, targetId: 3 }
        ],
        votedDeadId: 3
      },
      delay: 1000
    })

    this.events.push({
      type: 'player_died',
      playerId: 3,
      data: {
        playerId: 3,
        roleType: 'seer' as RoleType
      },
      delay: 1000
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Check_Win_Condition' as GamePhase,
        round: 1
      },
      delay: 500
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Night_Start' as GamePhase,
        round: 2
      },
      delay: 1000
    })

    this.events.push({
      type: 'agent_thinking',
      playerId: 1,
      thought: "Good! We eliminated the seer. Now we need to eliminate the witch or villagers.",
      data: { playerId: 1 },
      delay: 2000
    })

    this.events.push({
      type: 'player_action',
      playerId: 1,
      thought: "I'll attack player 4 (the witch) tonight.",
      data: {
        playerId: 1,
        roleType: 'wolf' as RoleType,
        actionType: 'kill' as ActionType,
        targetId: 4,
        content: undefined,
        thought: "I'll attack player 4 (the witch) tonight.",
        timestamp: Date.now()
      },
      delay: 1500
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Wolf_Action' as GamePhase,
        round: 2
      },
      delay: 1000
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Seer_Action' as GamePhase,
        round: 2
      },
      delay: 1000
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Witch_Action' as GamePhase,
        round: 2
      },
      delay: 1000
    })

    this.events.push({
      type: 'agent_thinking',
      playerId: 4,
      thought: "I'm being attacked tonight! I should save myself, but I already used my antidote...",
      data: { playerId: 4 },
      delay: 2000
    })

    this.events.push({
      type: 'player_action',
      playerId: 4,
      thought: "I can't save myself. I'll use my poison on player 1.",
      data: {
        playerId: 4,
        roleType: 'witch' as RoleType,
        actionType: 'poison' as ActionType,
        targetId: 1,
        content: undefined,
        thought: "I'll use poison on player 1 before I die.",
        timestamp: Date.now()
      },
      delay: 1500
    })

    this.events.push({
      type: 'night_result',
      data: {
        deadPlayerIds: [4, 1],
        killedByWolf: 4,
        poisonedByWitch: 1
      },
      delay: 1000
    })

    this.events.push({
      type: 'player_died',
      playerId: 4,
      data: {
        playerId: 4,
        roleType: 'witch' as RoleType
      },
      delay: 500
    })

    this.events.push({
      type: 'player_died',
      playerId: 1,
      data: {
        playerId: 1,
        roleType: 'wolf' as RoleType
      },
      delay: 500
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Day_Start' as GamePhase,
        round: 2
      },
      delay: 1000
    })

    this.events.push({
      type: 'phase_changed',
      data: {
        phase: 'Check_Win_Condition' as GamePhase,
        round: 2
      },
      delay: 500
    })

    this.events.push({
      type: 'game_over',
      data: {
        winner: 'villager' as Faction
      },
      delay: 1000
    })

    this.events.push({
      type: 'winner_declared',
      data: {
        winner: 'villager' as Faction,
        message: 'Villagers win! Both wolves have been eliminated.'
      },
      delay: 1000
    })
  }

  private createInitialPlayers() {
    return PLAYER_NAMES.map((name, index) => ({
      id: index + 1,
      name,
      roleType: ROLES[index],
      faction: ROLES[index] === 'wolf' ? 'wolf' : 'villager' as Faction,
      isAlive: true
    }))
  }

  /**
   * 为指定玩家返回一条示例“思考”文案。
   */
  private generateThought(playerId: number): string {
    const thoughts = [
      "Hmm, I need to be careful about what I reveal.",
      "The villagers seem suspicious. I should play along.",
      "I need to protect my identity while gathering information.",
      "Someone is lying, but who?",
      "I should vote for the most suspicious person.",
      "Let me think about the best strategy..."
    ]
    return thoughts[(playerId - 1) % thoughts.length]
  }

  /**
   * 为指定玩家返回一条示例发言文本。
   */
  private generateSpeech(playerId: number): string {
    const speeches = [
      "I think we need to be careful today. Not everyone is who they claim to be.",
      "I've been observing everyone's behavior, and something feels off.",
      "I'm a simple villager, just trying to survive this night.",
      "We need to find the wolves quickly before they eliminate us all.",
      "I trust most of you, but there's definitely something suspicious going on.",
      "Let's vote wisely today. Our lives depend on it."
    ]
    return speeches[(playerId - 1) % speeches.length]
  }

  on(event: string, callback: (data: any) => void) {
    this.callbacks.set(event, callback)
  }

  play() {
    if (this.isPlaying) return
    this.isPlaying = true
    this.isPaused = false
    this.scheduleNextEvent()
  }

  pause() {
    this.isPaused = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  nextStep() {
    if (this.currentIndex >= this.events.length) return

    const event = this.events[this.currentIndex]
    this.dispatchEvent(event)
    this.currentIndex++
  }

  private scheduleNextEvent() {
    if (this.currentIndex >= this.events.length || this.isPaused) {
      this.isPlaying = false
      return
    }

    const event = this.events[this.currentIndex]

    this.timer = setTimeout(() => {
      if (this.isPaused) {
        this.isPlaying = false
        return
      }
      this.dispatchEvent(event)
      this.currentIndex++
      this.scheduleNextEvent()
    }, event.delay)
  }

  private dispatchEvent(event: MockEvent) {
    const callback = this.callbacks.get(event.type)
    if (callback) {
      callback(event.data)
    }

    if (event.type === 'agent_thinking' && event.thought) {
      const thinkingCallback = this.callbacks.get('agent_thinking')
      if (thinkingCallback) {
        thinkingCallback({ playerId: event.playerId, thought: event.thought })
      }
    }
  }

  reset() {
    this.pause()
    this.currentIndex = 0
    this.isPlaying = false
    this.isPaused = false
  }

  /**
   * 判断事件流是否已回放结束。
   */
  isComplete(): boolean {
    return this.currentIndex >= this.events.length
  }

  /**
   * 返回当前回放游标位置。
   */
  getCurrentIndex(): number {
    return this.currentIndex
  }

  /**
   * 返回事件总数，便于计算回放进度。
   */
  getTotalEvents(): number {
    return this.events.length
  }
}
