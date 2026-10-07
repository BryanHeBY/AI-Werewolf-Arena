import type { MessageKey, MessageRef } from "@ai-werewolf-arena/game-text";
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
  code: "event_counts" | "process_counts" | "actions" | "invalid_day" | "request_mismatch";
  title: MessageKey;
  detail: MessageRef;
  evidence?: number[];
}

export interface DeterministicFinding {
  code: "first_day_blast" | "guard_mention" | "potion_claim" | "invalid_day" | "request_mismatch";
  severity: ReplayDebugReport["severity"];
  category: ReplayDebugReport["category"];
  day: number;
  phase: string;
  actorId: number;
  message: MessageRef;
  evidence: number[];
}
