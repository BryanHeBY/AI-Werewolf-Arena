import { CUPID_POLICIES } from "../core/domain/board";
import { boardConfigSchema } from "../core/domain/board_schema";
import { dictionaries, text, type MessageKey } from "@ai-werewolf-arena/game-text";
import { z } from "zod";
import {
  readGameOutcome,
  readVictoryPoint,
  readVictoryAffiliations,
} from "@ai-werewolf-arena/replay-contract";
import type {
  GameOutcome,
  VictoryPoint,
  VictoryAffiliation,
} from "@ai-werewolf-arena/game-catalog";
import { types } from "node:util";
import {
  ACTION_STAGES,
  SHERIFF_BADGE_POLICIES,
  TOOL_NAMES,
  WOLF_TEAM_EVENT_TYPES,
  ActionWindow,
  KnightDuelWindow,
  Camp,
  Phase,
  Role,
  WinCondition,
  WitchSelfHealRule,
  DeathCause,
  type ActionProvider,
  type ActionRequest,
  type BoardConfig,
  type GameEvent,
  type RuntimeSnapshot,
  type ToolCall,
} from "../core";
import type { RandomMetadata } from "../core/domain/random";

export const REPRODUCTION_SCHEMA_VERSION = 2 as const;
const ERROR_NAMES = [
  "Error",
  "TypeError",
  "RangeError",
  "AbortError",
  "TimeoutError",
  "AggregateError",
] as const;
export type RecordedErrorName = (typeof ERROR_NAMES)[number];
const FAILURE_SCOPES = ["initialization", "cycle", "cleanup", "recording", "controller"] as const;
export type ReproductionFailureScope = (typeof FAILURE_SCOPES)[number];
const nativeDomName = Object.getOwnPropertyDescriptor(DOMException.prototype, "name")?.get;
export function recordedErrorName(error: unknown): RecordedErrorName {
  const accepted = (value: unknown): RecordedErrorName =>
    typeof value === "string" && ERROR_NAMES.includes(value as RecordedErrorName)
      ? (value as RecordedErrorName)
      : "Error";
  try {
    if (!error || typeof error !== "object" || types.isProxy(error)) return "Error";
    // Native DOMException has a branded intrinsic accessor. Never call a
    // foreign name getter or trust a value merely because a prior read passed.
    try {
      const name = nativeDomName?.call(error);
      if (name !== undefined) return accepted(name);
    } catch {
      /* Not a DOMException. */
    }
    if (!types.isNativeError(error)) return "Error";
    let current: object | null = error;
    for (let depth = 0; current && depth < 8; depth++) {
      if (types.isProxy(current)) return "Error";
      const descriptor = Object.getOwnPropertyDescriptor(current, "name");
      if (descriptor) return "value" in descriptor ? accepted(descriptor.value) : "Error";
      current = Object.getPrototypeOf(current);
    }
  } catch {
    /* An exotic error cannot replace the original failure. */
  }
  return "Error";
}
export interface EngineVersion {
  id: "awa-engine";
  sourceHash: string;
  lockHash: string;
  commit?: string;
}
export interface ReproductionMetadata {
  engine: EngineVersion;
  random: RandomMetadata;
  ruleset: { id: string; version: string };
  boardId: string;
  normalizedBoard: BoardConfig;
  locale: "zh-CN" | "en";
  maxDays: number;
  dealMode: "random" | "fixed";
  initialDeal?: Role[];
  players: Array<{
    id: number;
    name: string;
    role: Role;
    camp: Camp;
    agent?: { kind: "llm" | "acp"; name: string; model?: string };
  }>;
}
export interface RecordedPlayerState {
  id: number;
  seat: number;
  name: string;
  role: Role;
  camp: Camp;
  alive: boolean;
  privateState: Record<string, unknown>;
  wallNote?: import("../core/domain/components/wall_note").WallNoteComponent;
  debatePenalty?: import("../core/domain/components/debate_penalty").DebatePenaltyComponent;
  lovers?: import("../core/domain/components/lovers").LoversComponent;
  vote: { weight: number; canVote: boolean };
  badge: {
    isSheriff: boolean;
    destroyed: boolean;
    voteWeight: number;
    handoffPolicy?: import("../core/domain/board").SheriffBadgePolicy;
  };
  marks: string[];
  victory: { affiliations: VictoryAffiliation[] };
}
export interface RecordedCheckpoint {
  thiefSetup?: {
    policy: "lui_meme_thief_two_extra_villagers_v1";
    status: "pending" | "complete" | "cancelled" | "failed";
    hands: Array<{ actorId: number; cardId: string; role: Role }>;
    reserve: [{ cardId: string; role: Role }, { cardId: string; role: Role }];
    selection: { actorId: number; slot: 0 | 1 | null; role: Role } | null;
  };
  cycle: number;
  complete: boolean;
  snapshot: RuntimeSnapshot;
  players: RecordedPlayerState[];
  eventCount: number;
  failure?: { name: RecordedErrorName; code: "cycle_failed" };
}
export interface RecordedDecision {
  actorId: number;
  day: number;
  stage: ActionRequest["context"]["stage"];
  turn: number;
  request: Omit<ActionRequest, "deadlineAtMs">;
  settleOrder?: number;
  openedAfterSettlement: number;
  outcome:
    | { kind: "pending" }
    | { kind: "action"; action: ToolCall | null }
    | { kind: "error"; code: "decision_failed"; name: RecordedErrorName };
}
/** Serialized evidence envelope, including legacy events without authorization. */
export interface RecordedGameEvent {
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
  audience?: readonly number[];
}
export interface ReproductionRecord {
  schemaVersion: typeof REPRODUCTION_SCHEMA_VERSION;
  finalized: boolean;
  metadata: ReproductionMetadata;
  decisions: RecordedDecision[];
  checkpoints: RecordedCheckpoint[];
  events: RecordedGameEvent[];
  operations: Array<{
    scope: string;
    op: string;
    actor_id?: number;
    phase?: string;
    status: string;
    reason?: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
  }>;
  termination: {
    reason: string;
    winner: Camp | null;
    errors: Array<{ scope: ReproductionFailureScope; name: RecordedErrorName }>;
  } | null;
}

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonnegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const jsonObject = z.record(z.string(), z.json());
const messageRefSchema = z
  .strictObject({
    key: z.enum(Object.keys(dictionaries["zh-CN"]) as [MessageKey, ...MessageKey[]]),
    parameters: z.record(z.string(), z.union([z.string(), z.number().finite()])).optional(),
  })
  .superRefine((message, ctx) => {
    try {
      text("zh-CN", message.key, message.parameters);
    } catch {
      ctx.addIssue({ code: "custom", message: "reproduction_message_reference_invalid" });
    }
  });
const requestSchema = z.strictObject({
  actorId: positive,
  phase: z.enum(Phase),
  actionWindow: z.enum(ActionWindow).optional(),
  allowedTools: z.array(z.enum(TOOL_NAMES)),
  context: z.strictObject({
    action_failure_policy: z.literal("error").optional(),
    allow_fallback: z.boolean().optional(),
    day: positive,
    stage: z.enum(ACTION_STAGES),
    visible_events: z.array(
      z.strictObject({ seq: positive, type: z.string().min(1), payload: jsonObject }),
    ),
    turn_constraints: z.strictObject({
      min_valid_actions: nonnegative.optional(),
      max_valid_actions: nonnegative.optional(),
      required_any_tools: z.array(z.enum(TOOL_NAMES)).optional(),
      summary: z.string().optional(),
      summary_message: messageRefSchema.optional(),
    }),
    wall_id: z.literal("wall:1").optional(),
    item_instance_id: z
      .string()
      .regex(/^wall:1:[1-9][0-9]*$/)
      .optional(),
    debate_id: z
      .string()
      .regex(/^debate:[1-9][0-9]*:[1-9][0-9]*:[1-9][0-9]*:[1-9][0-9]*$/)
      .optional(),
    debate_actor_id: positive.optional(),
    debate_target_id: positive.optional(),
    ability_id: z
      .string()
      .regex(/^[a-z][a-z0-9:_-]{0,127}$/)
      .optional(),
    duel_window: z.enum(KnightDuelWindow).optional(),
    wolf_target: positive.nullable().optional(),
    trigger: z.string().optional(),
    death_phase: z.enum(Phase).optional(),
    death_sources: z.array(z.enum(DeathCause)).optional(),
    death_action_id: positive.optional(),
    sheriff_candidates: z.array(positive).optional(),
    exile_candidates: z.array(positive).optional(),
    badge_candidates: z.array(positive).optional(),
    round: positive.optional(),
    max_rounds: positive.optional(),
    retry_attempt: nonnegative.optional(),
    retry_max: nonnegative.optional(),
    retry_reason: z.string().optional(),
    retry_notice: z.string().optional(),
    retry_notice_message: messageRefSchema.optional(),
  }),
});
const outcomeSchema = z.unknown().transform((value, ctx): GameOutcome => {
  try {
    return readGameOutcome(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "reproduction_outcome_invalid" });
    return z.NEVER;
  }
});
const pointSchema = z.unknown().transform((value, ctx): VictoryPoint => {
  try {
    return readVictoryPoint(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "reproduction_victory_point_invalid" });
    return z.NEVER;
  }
});
const resultSchema = z
  .strictObject({
    winner: z.enum(Camp).nullable(),
    reason: z.string().min(1),
    outcome: outcomeSchema,
    decidedAt: pointSchema,
  })
  .superRefine((value, ctx) => {
    const winner =
      value.outcome.kind === "victory" && value.outcome.primary.kind === "faction"
        ? value.outcome.primary.faction
        : null;
    if (value.winner !== winner)
      ctx.addIssue({ code: "custom", message: "reproduction_winner_projection_invalid" });
  });
const snapshotSchema = z.strictObject({
  day: positive,
  phase: z.enum(Phase),
  gameOver: z.boolean(),
  result: resultSchema.nullable(),
});
const affiliationsSchema = z.unknown().transform((value, ctx): VictoryAffiliation[] => {
  try {
    return readVictoryAffiliations(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "reproduction_affiliations_invalid" });
    return z.NEVER;
  }
});
const playerSchema = z
  .strictObject({
    id: positive,
    seat: positive,
    name: z.string(),
    role: z.enum(Role),
    camp: z.enum(Camp),
    alive: z.boolean(),
    privateState: jsonObject,
    wallNote: z
      .strictObject({
        instanceId: z.string().regex(/^wall:1:[1-9][0-9]*$/),
        source: z.strictObject({
          kind: z.literal("wall_event"),
          eventId: z.literal("awa_wall_notes_v1"),
          day: z.literal(1),
        }),
        remaining: z.union([z.literal(0), z.literal(1)]),
        expired: z.boolean(),
      })
      .optional(),
    debatePenalty: z
      .strictObject({
        day: positive,
        sourceId: positive,
        lifeVersion: z.number().int().nonnegative(),
      })
      .optional(),
    lovers: z
      .strictObject({
        actorId: positive,
        day: z.literal(1),
        policy: z.enum(CUPID_POLICIES),
        pairIds: z.tuple([positive, positive]),
        pairCamps: z.tuple([z.enum([Camp.Good, Camp.Wolf]), z.enum([Camp.Good, Camp.Wolf])]),
        groupId: z.literal("cupid_lovers"),
        mixed: z.boolean(),
      })
      .refine(
        (record) =>
          record.pairIds[0] !== record.pairIds[1] &&
          record.mixed === (record.pairCamps[0] !== record.pairCamps[1]),
        "reproduction_lovers_invalid",
      )
      .optional(),
    victory: z.strictObject({ affiliations: affiliationsSchema }),
    vote: z.strictObject({ weight: z.number().finite().nonnegative(), canVote: z.boolean() }),
    badge: z.strictObject({
      isSheriff: z.boolean(),
      destroyed: z.boolean(),
      voteWeight: z.number().finite().positive(),
      handoffPolicy: z.enum(SHERIFF_BADGE_POLICIES).optional(),
    }),
    marks: z.array(z.string()),
  })
  .refine(
    (player) => !player.wallNote || player.wallNote.instanceId === `wall:1:${player.id}`,
    "reproduction_wall_owner_invalid",
  );
const thiefCardSchema = z.strictObject({
  cardId: z.string().regex(/^deal:[0-9]+$/),
  role: z.enum(Role),
});
const thiefSetupSchema = z.strictObject({
  policy: z.literal("lui_meme_thief_two_extra_villagers_v1"),
  status: z.enum(["pending", "complete", "cancelled", "failed"]),
  hands: z.array(thiefCardSchema.extend({ actorId: positive })),
  reserve: z.tuple([thiefCardSchema, thiefCardSchema]),
  selection: z
    .strictObject({
      actorId: positive,
      slot: z.union([z.literal(0), z.literal(1), z.null()]),
      role: z.enum(Role),
    })
    .nullable(),
});
const schema = z.strictObject({
  schemaVersion: z.literal(REPRODUCTION_SCHEMA_VERSION),
  finalized: z.boolean(),
  metadata: z.strictObject({
    engine: z.strictObject({
      id: z.literal("awa-engine"),
      sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
      lockHash: z.string().regex(/^[a-f0-9]{64}$/),
      commit: z
        .string()
        .regex(/^[a-f0-9]{40}$/)
        .optional(),
    }),
    random: z.strictObject({
      seed: z.string().min(1),
      algorithm: z.string().min(1),
      streamPolicy: z.string().min(1),
      path: z.array(z.string()),
    }),
    ruleset: z.strictObject({ id: z.string().min(1), version: z.string().min(1) }),
    boardId: z.string().regex(/^[a-z][a-z0-9_-]*$/),
    normalizedBoard: boardConfigSchema,
    locale: z.enum(["zh-CN", "en"]),
    maxDays: positive,
    dealMode: z.enum(["random", "fixed"]),
    initialDeal: z.array(z.enum(Role)).min(3).max(130).optional(),
    players: z
      .array(
        z.strictObject({
          id: positive,
          name: z.string(),
          role: z.enum(Role),
          camp: z.enum(Camp),
          agent: z
            .strictObject({
              kind: z.enum(["llm", "acp"]),
              name: z.string(),
              model: z.string().optional(),
            })
            .optional(),
        }),
      )
      .min(1),
  }),
  decisions: z.array(
    z.strictObject({
      actorId: positive,
      day: positive,
      stage: z.enum(ACTION_STAGES),
      turn: positive,
      request: requestSchema,
      settleOrder: positive.optional(),
      openedAfterSettlement: nonnegative,
      outcome: z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("pending") }),
        z.strictObject({
          kind: z.literal("action"),
          action: z.strictObject({ name: z.enum(TOOL_NAMES), args: jsonObject }).nullable(),
        }),
        z.strictObject({
          kind: z.literal("error"),
          code: z.literal("decision_failed"),
          name: z.enum(ERROR_NAMES),
        }),
      ]),
    }),
  ),
  checkpoints: z
    .array(
      z
        .strictObject({
          cycle: nonnegative,
          complete: z.boolean(),
          snapshot: snapshotSchema,
          thiefSetup: thiefSetupSchema.optional(),
          players: z.array(playerSchema),
          eventCount: nonnegative,
          failure: z
            .strictObject({ name: z.enum(ERROR_NAMES), code: z.literal("cycle_failed") })
            .optional(),
        })
        .superRefine((value, ctx) => {
          const result = value.snapshot.result;
          if (result) {
            try {
              readGameOutcome(
                result.outcome,
                value.players.map((player) => player.id),
              );
            } catch {
              ctx.addIssue({ code: "custom", message: "reproduction_winner_player_unknown" });
            }
            if (
              !value.snapshot.gameOver ||
              value.snapshot.phase !== Phase.GameOver ||
              result.decidedAt.day !== value.snapshot.day
            )
              ctx.addIssue({ code: "custom", message: "reproduction_result_point_invalid" });
          } else if (value.snapshot.gameOver)
            ctx.addIssue({ code: "custom", message: "reproduction_result_missing" });
        }),
    )
    .min(1),
  events: z.array(
    z
      .strictObject({
        timestamp: z.number().finite(),
        type: z.string().min(1),
        payload: jsonObject,
        audience: z
          .array(positive)
          .max(128)
          .refine((ids) => ids.every((id, index) => index === 0 || ids[index - 1] < id))
          .optional(),
      })
      .superRefine((event, ctx) => {
        if (
          event.audience !== undefined &&
          !(WOLF_TEAM_EVENT_TYPES as readonly string[]).includes(event.type)
        ) {
          ctx.addIssue({ code: "custom", message: "reproduction_event_audience_invalid" });
        }
      }),
  ),
  operations: z.array(
    z.strictObject({
      scope: z.string(),
      op: z.string(),
      actor_id: positive.optional(),
      phase: z.string().optional(),
      status: z.string(),
      reason: z.string().optional(),
      input: jsonObject.optional(),
      output: jsonObject.optional(),
    }),
  ),
  termination: z
    .strictObject({
      reason: z.string(),
      winner: z.enum(Camp).nullable(),
      errors: z.array(z.strictObject({ scope: z.enum(FAILURE_SCOPES), name: z.enum(ERROR_NAMES) })),
    })
    .nullable(),
});

/** A serialization boundary: strict envelopes, then runtime validates role and board semantics. */
export function parseReproductionRecord(value: unknown): ReproductionRecord {
  if (
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion !== REPRODUCTION_SCHEMA_VERSION
  )
    throw new Error("reproduction_schema_not_supported");
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("reproduction_record_invalid");
  const result = parsed.data as unknown as ReproductionRecord;
  validateThiefRecord(result);
  return result;
}

export function normalizedRequest(request: ActionRequest): Omit<ActionRequest, "deadlineAtMs"> {
  const { deadlineAtMs: _deadline, ...facts } = request;
  return structuredClone(facts);
}

export class ReproductionTrace {
  private readonly decisions: RecordedDecision[] = [];
  private readonly checkpoints: RecordedCheckpoint[] = [];
  private events: RecordedGameEvent[] = [];
  private settled = 0;
  private invalid = false;
  private readonly errors: Array<{ scope: ReproductionFailureScope; name: RecordedErrorName }> = [];
  private readonly turns = new Map<string, number>();
  constructor(
    private readonly metadata: ReproductionMetadata,
    private readonly onChange: () => void,
  ) {
    this.metadata = structuredClone(metadata);
  }

  async decide(request: ActionRequest, provider: ActionProvider): Promise<ToolCall | null> {
    const key = `${request.actorId}/${request.context.day}/${request.context.stage}`;
    const turn = (this.turns.get(key) ?? 0) + 1;
    this.turns.set(key, turn);
    const entry: RecordedDecision = {
      actorId: request.actorId,
      day: request.context.day,
      stage: request.context.stage,
      turn,
      request: normalizedRequest(request),
      openedAfterSettlement: this.settled,
      outcome: { kind: "pending" },
    };
    this.decisions.push(entry);
    this.onChange();
    try {
      const action = await provider.getAction(request);
      entry.outcome = { kind: "action", action: structuredClone(action) };
      entry.settleOrder = ++this.settled;
      this.onChange();
      return action;
    } catch (error) {
      // Transport error strings may contain credentials. Preserve a reproducible failure, not its raw message.
      entry.outcome = { kind: "error", code: "decision_failed", name: recordedErrorName(error) };
      entry.settleOrder = ++this.settled;
      this.onChange();
      throw error;
    }
  }

  invalidate(): void {
    this.invalid = true;
    this.onChange();
  }

  noteFailure(scope: ReproductionFailureScope, error: unknown): void {
    this.errors.push({ scope, name: recordedErrorName(error) });
    this.onChange();
  }

  checkpoint(checkpoint: RecordedCheckpoint, events: readonly GameEvent[]): void {
    if (events.length !== checkpoint.eventCount)
      throw new Error("reproduction_checkpoint_events_mismatch");
    this.checkpoints.push(structuredClone(checkpoint));
    this.events = structuredClone(
      events.map(({ payload, ...event }) => ({ ...event, payload: { ...payload } })),
    );
    this.onChange();
  }

  build(input?: {
    operations: ReproductionRecord["operations"];
    termination: { reason: string; winner: Camp | null };
  }): ReproductionRecord {
    const record = {
      schemaVersion: REPRODUCTION_SCHEMA_VERSION,
      finalized: Boolean(input),
      metadata: this.metadata,
      decisions: this.decisions,
      checkpoints: this.checkpoints,
      events: this.events,
      operations: input?.operations ?? [],
      termination: input ? { ...input.termination, errors: this.errors } : null,
    };
    if (input && this.invalid) throw new Error("reproduction_trace_incomplete");
    if (input && this.decisions.some((entry) => entry.outcome.kind === "pending"))
      throw new Error("reproduction_decisions_pending");
    return parseReproductionRecord(record);
  }
}

/** New Thief archives carry the original full deal; old ordinary archives keep their exact shape. */
function validateThiefRecord(record: ReproductionRecord): void {
  const m = record.metadata,
    hasThief = m.normalizedBoard.roleSetups.some((row) => row.role === Role.Thief && row.count > 0);
  const fail = () => {
    throw new Error("reproduction_thief_state_invalid");
  };
  if (!hasThief) {
    if (m.initialDeal !== undefined || record.checkpoints.some((c) => c.thiefSetup !== undefined))
      fail();
    return;
  }
  const initial = m.initialDeal,
    n = m.normalizedBoard.boardSize;
  if (!initial || initial.length !== n + 2 || m.players.length !== n) return fail();
  const deck = m.normalizedBoard.roleSetups.flatMap((row) => Array<Role>(row.count).fill(row.role));
  deck.push(Role.Villager, Role.Villager);
  if (
    [...initial].sort().join(",") !== deck.sort().join(",") ||
    initial.filter((role) => role === Role.Thief).length !== 1
  )
    fail();
  const supported = [
    Role.Thief,
    Role.Wolf,
    Role.Villager,
    Role.Seer,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
    Role.Idiot,
  ];
  if (
    initial.some((role) => !supported.includes(role)) ||
    m.players.some(
      (p, i) => p.role !== initial[i] || p.camp !== (p.role === Role.Wolf ? Camp.Wolf : Camp.Good),
    )
  )
    fail();
  const actorIndex = initial.slice(0, n).indexOf(Role.Thief),
    actorId = actorIndex < 0 ? null : m.players[actorIndex]!.id;
  const originalIds = Array.from({ length: n + 2 }, (_, i) => `deal:${i}`);
  let previousStatus: string | undefined, previousSelection: string | undefined;
  for (const checkpoint of record.checkpoints) {
    const state = checkpoint.thiefSetup;
    if (!state || state.hands.length !== n || state.reserve.length !== 2) return fail();
    const cards = [...state.hands, ...state.reserve];
    if (
      new Set(cards.map((card) => card.cardId)).size !== n + 2 ||
      cards.some(
        (card) =>
          !originalIds.includes(card.cardId) ||
          initial[originalIds.indexOf(card.cardId)] !== card.role,
      )
    )
      fail();
    if (
      new Set(state.hands.map((hand) => hand.actorId)).size !== n ||
      state.hands.some((hand) => !m.players.some((p) => p.id === hand.actorId))
    )
      fail();
    const selection = state.selection;
    if (checkpoint.cycle > 0 && state.status === "pending") fail();
    if (checkpoint.cycle === 0 && (state.status !== "pending" || selection !== null)) fail();
    if (
      previousStatus &&
      previousStatus !== "pending" &&
      (state.status !== previousStatus || JSON.stringify(selection) !== previousSelection)
    )
      fail();
    previousStatus = state.status;
    previousSelection = JSON.stringify(selection);
    if (state.status !== "complete" && selection !== null) fail();
    if (state.status === "complete" && (actorId === null) !== (selection === null)) fail();
    if (
      selection &&
      (selection.actorId !== actorId ||
        (selection.slot === null
          ? selection.role !== Role.Thief
          : selection.role !== initial[n + selection.slot]))
    )
      fail();
    if (selection?.slot === null && initial[n] === Role.Wolf && initial[n + 1] === Role.Wolf)
      fail();
    for (let i = 0; i < n; i++) {
      const player = m.players[i]!,
        hand = state.hands.find((h) => h.actorId === player.id),
        current = checkpoint.players.find((p) => p.id === player.id);
      const expected =
        i === actorIndex && selection?.slot !== undefined && selection.slot !== null
          ? `deal:${n + selection.slot}`
          : `deal:${i}`;
      if (
        !hand ||
        !current ||
        hand.cardId !== expected ||
        current.role !== hand.role ||
        current.camp !== (hand.role === Role.Wolf ? Camp.Wolf : Camp.Good)
      )
        fail();
    }
    for (const slot of [0, 1] as const) {
      const expected = selection?.slot === slot ? `deal:${actorIndex}` : `deal:${n + slot}`;
      if (state.reserve[slot].cardId !== expected) fail();
    }
  }
}
