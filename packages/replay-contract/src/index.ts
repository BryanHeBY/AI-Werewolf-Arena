/**
 * The replay data shape consumed by browser and video clients.
 *
 * `god` means the complete referee view: it contains every role and public
 * event needed to reconstruct a finished game. It is not a player projection.
 */
export type ReplayPerspective = "god";

export interface ReplayEvent {
  seq: number;
  timestamp: string;
  phase: string;
  day: number;
  stage?: string;
  type: string;
  payload: Record<string, unknown>;
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
  }>;
  events: ReplayEvent[];
}
