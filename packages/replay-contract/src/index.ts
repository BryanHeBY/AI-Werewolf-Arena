function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The replay data shape consumed by browser and video clients.
 *
 * `god` means the complete referee view: it contains every role and public
 * event needed to reconstruct a game, including one still in progress.
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
    name?: string;
  }>;
  events: ReplayEvent[];
}

export class ReplayDocumentValidationError extends Error {
  constructor(
    readonly kind: "invalid_document" | "missing_fields" | "invalid_field",
    readonly path: string,
  ) {
    super(`replay_document_invalid:${path}`);
    this.name = "ReplayDocumentValidationError";
  }
}

function assertField(valid: boolean, path: string): asserts valid {
  if (!valid) throw new ReplayDocumentValidationError("invalid_field", path);
}


/** Validates the canonical, unfiltered document; event sequence numbers start at one. */
export function assertReplayDocument(value: unknown): asserts value is ReplayDocument {
  if (
    !isRecord(value) || value.perspective !== "god" ||
    typeof value.sessionId !== "string" || !Array.isArray(value.events)
  ) {
    throw new ReplayDocumentValidationError("invalid_document", "document");
  }
  if (!isRecord(value.meta) || !isRecord(value.result) || !Array.isArray(value.players)) {
    throw new ReplayDocumentValidationError("missing_fields", "meta/result/players");
  }

  assertField(typeof value.meta.board === "string", "meta.board");
  assertField(typeof value.meta.startedAt === "string", "meta.startedAt");
  assertField(typeof value.meta.endedAt === "string", "meta.endedAt");
  assertField(value.result.winner === null || typeof value.result.winner === "string", "result.winner");
  assertField(value.result.reason === null || typeof value.result.reason === "string", "result.reason");

  const playerIds = new Set<number>();
  for (let index = 0; index < value.players.length; index += 1) {
    const player: unknown = value.players[index];
    const path = `players[${index}]`;
    assertField(isRecord(player), path);
    assertField(
      typeof player.player_id === "number" && Number.isSafeInteger(player.player_id) && player.player_id > 0,
      `${path}.player_id`,
    );
    assertField(!playerIds.has(player.player_id), `${path}.player_id`);
    playerIds.add(player.player_id);
    assertField(typeof player.role === "string", `${path}.role`);
    assertField(typeof player.camp === "string", `${path}.camp`);
    assertField(player.name === undefined || typeof player.name === "string", `${path}.name`);
  }

  for (let index = 0; index < value.events.length; index += 1) {
    const event: unknown = value.events[index];
    const path = `events[${index}]`;
    assertField(isRecord(event), path);
    assertField(event.seq === index + 1, `${path}.seq`);
    assertField(typeof event.timestamp === "string", `${path}.timestamp`);
    assertField(typeof event.phase === "string", `${path}.phase`);
    assertField(
      typeof event.day === "number" && Number.isSafeInteger(event.day) && event.day >= 0,
      `${path}.day`,
    );
    assertField(event.stage === undefined || typeof event.stage === "string", `${path}.stage`);
    assertField(typeof event.type === "string", `${path}.type`);
    assertField(isRecord(event.payload), `${path}.payload`);
  }
}
