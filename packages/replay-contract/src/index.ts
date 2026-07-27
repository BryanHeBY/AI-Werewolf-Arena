/**
 * The replay data shape consumed by browser and video clients.
 *
 * V1 deliberately mirrors the complete session record so that the React
 * player and Remotion renderer can be wired before perspective isolation is
 * designed. Do not expose this document to untrusted users: it may contain
 * god and player-private information.
 */
export const REPLAY_DOCUMENT_SCHEMA_VERSION = "v1" as const;

export type ReplayPerspective = "unredacted";

export interface ReplayEvent {
  seq: number;
  timestamp: string;
  phase: string;
  day: number;
  stage?: string;
  type: string;
  payload: Record<string, unknown>;
  render_text?: string;
}

export interface ReplayPhaseStageWindow {
  stage: string;
  start_seq: number;
  end_seq: number;
}

export interface ReplayPhaseWindow {
  phase_id: string;
  day: number;
  phase: string;
  start_seq: number;
  end_seq: number;
  stages: ReplayPhaseStageWindow[];
}

export interface ReplayDocument {
  schemaVersion: typeof REPLAY_DOCUMENT_SCHEMA_VERSION;
  sessionId: string;
  perspective: ReplayPerspective;
  meta: {
    board: string;
    startedAt: string;
    endedAt: string;
  };
  result: {
    winner: string | null;
    reason: string | null;
  };
  players: Array<{
    player_id: number;
    role: string;
    camp: string;
    alive: boolean;
  }>;
  events: ReplayEvent[];
  phaseWindows: ReplayPhaseWindow[];
}
