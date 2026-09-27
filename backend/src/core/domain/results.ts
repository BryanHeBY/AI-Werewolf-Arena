import type { Camp, EntityId, Phase } from "./identity";

export interface GameResult {
  winner: Camp | null;
  reason: string;
}

export interface SeerCheckResult {
  seerId: EntityId;
  targetId: EntityId;
  isWerewolf: boolean;
}

export interface NightSummary {
  wolfTarget: EntityId | null;
  deaths: EntityId[];
  seerChecks: SeerCheckResult[];
  interruptedBySelfDestruct: boolean;
}

export interface DaySummary {
  speeches: Array<{ actorId: EntityId; text: string }>;
  selfDestructBy: EntityId | null;
}

export interface VotingSummary {
  tally: Record<number, number>;
  target: EntityId | null;
  removed: EntityId[];
}

export interface RuntimeSnapshot {
  day: number;
  phase: Phase;
  gameOver: boolean;
  result: GameResult | null;
}
