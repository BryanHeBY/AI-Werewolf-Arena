import {
  ReplayManifest,
  ReplayPhaseWindow,
  ReplayPublicEvent,
} from "../observability/types";

/**
 * V1 integration document for the React player and Remotion renderer.
 *
 * It is intentionally unredacted during the framework migration. Perspective
 * projection belongs behind this factory once the product's replay permissions
 * are specified; until then callers must treat the endpoint as trusted-only.
 */
export interface ReplaySourceDocument {
  schemaVersion: "v1";
  perspective: "unredacted";
  sessionId: string;
  meta: {
    board: string;
    startedAt: string;
    endedAt: string;
  };
  result: {
    winner: string | null;
    reason: string | null;
  };
  players: ReplayManifest["players"];
  events: ReplayPublicEvent[];
  phaseWindows: ReplayPhaseWindow[];
}

export function createReplaySourceDocument(input: {
  manifest: ReplayManifest;
  events: ReplayPublicEvent[];
  phaseWindows: ReplayPhaseWindow[];
}): ReplaySourceDocument {
  const { manifest, events, phaseWindows } = input;
  return {
    schemaVersion: "v1",
    perspective: "unredacted",
    sessionId: manifest.session_id,
    meta: {
      board: manifest.board,
      startedAt: manifest.started_at,
      endedAt: manifest.ended_at,
    },
    result: {
      winner: manifest.winner,
      reason: manifest.finish_reason || null,
    },
    players: manifest.players,
    events,
    phaseWindows,
  };
}
