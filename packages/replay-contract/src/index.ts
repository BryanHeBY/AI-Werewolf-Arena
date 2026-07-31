/**
 * The replay data shape consumed by browser and video clients.
 *
 * The document mirrors the complete session record so that the React player
 * and Remotion renderer can be wired before perspective isolation is designed.
 */
export type ReplayPerspective = "unredacted";

export interface ReplayEvent {
  seq: number;
  timestamp: string;
  phase: string;
  day: number;
  stage?: string;
  type: string;
  payload: Record<string, unknown>;
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
