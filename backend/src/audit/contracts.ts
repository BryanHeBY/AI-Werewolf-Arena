/**
 * Responsibility: define audit task/evidence data and neutral result descriptions.
 * Input: recorded execution evidence and configured audit requirements;
 * output: audit request/result contracts, preserving raw model content separately.
 * The audit subsystem owns these evidence/task shapes; recording owns stored sessions.
 * These declarations do not run audits, select game actions or render translations.
 */
import type { MessageKey, MessageRef } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-catalog";
import type {
  ReplayDebugReport,
  ReplayLogicOp,
  ReplayManifest,
  ReplayPlayerView,
  ReplayPublicEvent,
} from "../recording/contracts";

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
