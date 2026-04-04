// src/types/v2-types.ts// Reference existing types
import { GamePhase, Faction, RoleType } from "./index";

export enum ActionType {
  Kill = "kill",
  Save = "save",
  Poison = "poison",
  Check = "check",
  Speak = "speak",
  Vote = "vote",
  NoAction = "no_action",
  SelfDestruct = "self_destruct",
  SheriffRun = "sheriff_run",
  SheriffVote = "sheriff_vote",
}

export interface PlayerInfo {
  id: number;
  name: string;
  /**
   * Visible only to players who have perspective access
   * (e.g., seer can see roles, but villagers cannot)
   */
  roleType?: RoleType;
  /**
   * Visible only to players who have perspective access
   */
  faction?: Faction;
  isAlive: boolean;
  isSheriff?: boolean;
}

export interface StackNode {
  phase: GamePhase;
  context?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  type: "speak" | "action" | "system";
  playerId?: number;
  playerName?: string;
  content: string;
  /**
   * Visible only when perspective rules allow
   * (e.g., werewolves see private thoughts of pack members)
   */
  privateThought?: string;
  timestamp: number;
}

export interface SubmitAction {
  actionType: ActionType;
  targetId?: number;
  content?: string;
}

export interface GameStateUpdate {
  phase: GamePhase;
  round: number;
  players: PlayerInfo[];
  deadPlayerIds: number[];
  history: ChatMessage[];
  nightResult?: any; // Placeholder until defined
  votedDeadId?: number;
  winner?: Faction;
  witchHasAntidote: boolean;
  witchHasPoison: boolean;
  currentSpeechIndex: number;
  phaseStack: StackNode[];
}

// WebSocket Event Types
export type WebSocketEvent =
  | { type: "gameStateUpdate"; data: GameStateUpdate }
  | { type: "chatMessage"; data: ChatMessage }
  | { type: "submitAction"; data: SubmitAction }
  | { type: "ping" }
  | { type: "pong" }
  | { type: "requestFullState" };
