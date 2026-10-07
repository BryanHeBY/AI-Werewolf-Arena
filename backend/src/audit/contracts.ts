import type { Locale } from "@ai-werewolf-arena/game-catalog";
import type { ReplayDebugReport, ReplayLogicOp, ReplayManifest, ReplayPlayerView, ReplayPublicEvent } from "../recording/contracts";

export interface BuildDebugSummaryInput {
  /** Inspection language; source text stays original. */
  locale?: Locale;
  /** Final summary language, independent of audit availability. */
  displayLocale?: Locale;
  manifest: ReplayManifest;
  reports: ReplayDebugReport[];
  publicEvents?: ReplayPublicEvent[];
  logicOps?: ReplayLogicOp[];
  playerViews?: ReplayPlayerView[];
  sessionDir?: string;
}

export interface SummaryObservation {
  title: string;
  detail: string;
  evidence?: number[];
}

export interface DeterministicFinding {
  severity: ReplayDebugReport["severity"];
  category: ReplayDebugReport["category"];
  day: number;
  phase: string;
  actorId: number;
  message: string;
  evidence: number[];
}
