import { isRecord, assertField, ReplayDocumentValidationError } from "./validation";
export { ReplayDocumentValidationError } from "./validation";
import { isLocale, type Locale } from "@ai-werewolf-arena/game-catalog";
import { legacyPhaseId, legacyStageId, legacyRoleId, legacyCampId, legacyResultReasonId } from "./legacy_aliases";
export * from "./legacy_aliases";
export const REPLAY_SCHEMA_VERSION = 2 as const;

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
  schemaVersion: typeof REPLAY_SCHEMA_VERSION;
  sessionId: string;
  perspective: ReplayPerspective;
  meta: {
    locale?: Locale;
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

/** Validates the canonical, unfiltered document; event sequence numbers start at one. */
function assertReplayShape(value: unknown): asserts value is Omit<ReplayDocument, "schemaVersion"> & { schemaVersion?: unknown } {
  if (
    !isRecord(value) || value.perspective !== "god" ||
    typeof value.sessionId !== "string" || !Array.isArray(value.events)
  ) {
    throw new ReplayDocumentValidationError("invalid_document", "document");
  }
  if (!isRecord(value.meta) || !isRecord(value.result) || !Array.isArray(value.players)) {
    throw new ReplayDocumentValidationError("missing_fields", "meta/result/players");
  }

  assertField(value.meta.locale === undefined || isLocale(value.meta.locale), "meta.locale");
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

/** Canonical v2 writer contract. Use readReplayDocument for archived documents. */
export function assertReplayDocument(value: unknown): asserts value is ReplayDocument {
  assertReplayShape(value);
  if (value.schemaVersion !== REPLAY_SCHEMA_VERSION) throw new ReplayDocumentValidationError("unsupported_version", "schemaVersion");
}

/** Read-only conversion; version negotiation occurs before any legacy interpretation. */
export function readReplayDocument(value: unknown): ReplayDocument {
  if (!isRecord(value)) throw new ReplayDocumentValidationError("invalid_document", "document");
  const version = value.schemaVersion;
  if (version !== undefined && version !== 1 && version !== REPLAY_SCHEMA_VERSION) throw new ReplayDocumentValidationError("unsupported_version", "schemaVersion");
  assertReplayShape(value);
  if (version === REPLAY_SCHEMA_VERSION) return structuredClone(value) as ReplayDocument;
  const result = structuredClone(value) as ReplayDocument;
  result.schemaVersion = REPLAY_SCHEMA_VERSION;
  result.players = result.players.map(player => ({ ...player, role: legacyRoleId(player.role), camp: legacyCampId(player.camp) }));
  result.result.winner = result.result.winner === null ? null : legacyCampId(result.result.winner);
  result.result.reason = result.result.reason === null ? null : legacyResultReasonId(result.result.reason);
  result.events = result.events.map(event => {
    const payload = { ...event.payload };
    if (event.type === "phase_changed" && typeof payload.phase === "string") payload.phase = legacyPhaseId(payload.phase);
    if (event.type === "game_over" || event.type === "phase_changed") {
      if (typeof payload.winner === "string") payload.winner = legacyCampId(payload.winner);
      if (typeof payload.reason === "string") payload.reason = legacyResultReasonId(payload.reason);
    }
    if (event.type === "god_private_game_info" && Array.isArray(payload.players)) payload.players = payload.players.map(player => isRecord(player) ? {
      ...player, ...(typeof player.role === "string" ? { role: legacyRoleId(player.role) } : {}), ...(typeof player.camp === "string" ? { camp: legacyCampId(player.camp) } : {}),
    } : player);
    return { ...event, phase: legacyPhaseId(event.phase), ...(event.stage === undefined ? {} : { stage: legacyStageId(event.stage) }), payload };
  });
  return result;
}

export * from "./player_record";
