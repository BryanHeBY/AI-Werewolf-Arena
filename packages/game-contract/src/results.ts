/**
 * Owns engine result and phase-summary data for recording and protocol consumers.
 * Inputs are contract identities, inspection facts and victory data; outputs
 * retain original enum-typed Camp/Phase fields, nulls and optional properties.
 * These snapshots do not select winners, resolve deaths or authorize actions.
 */
import type { Camp, EntityId, Phase } from "./identity";
import type { InspectionResult } from "./inspection";
import type { GameOutcome, VictoryPoint } from "./outcomes";

export interface GameResult {
  winner: Camp | null;
  reason: string;
  outcome: GameOutcome;
  decidedAt: VictoryPoint;
}
export type WinDecision = Omit<GameResult, "decidedAt">;

export interface SeerCheckResult {
  seerId: EntityId;
  targetId: EntityId;
  isWerewolf: boolean;
  result: Extract<InspectionResult, { kind: "camp" }>;
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
  /** Actual exile outcome; target remains the public ballot winner. */
  effectiveTarget?: EntityId | null;
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
