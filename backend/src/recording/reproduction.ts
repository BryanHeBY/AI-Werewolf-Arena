import { readOrderPrinceChoiceFact, readOrderPrinceRevoteFact } from "@ai-werewolf-arena/game-text";
import { validateOrderPrinceRecord } from "./order_prince_record";
import {
  readNightmareFearFact,
  readMagicianExchangeFact,
  readDeathShotMissFact,
} from "@ai-werewolf-arena/game-text";
import { validateDemonHunterRecord } from "./demon_hunter_record";
import { validateMagicianRecord } from "./magician_record";
import { readFaultPlan, type FaultPlan } from "../core/domain/fault_plan";
import { DEMON_HUNTER_EVENT_TYPES } from "@ai-werewolf-arena/game-text";
import {
  GHOST_BRIDE_EVENT_TYPES,
  GHOST_BRIDE_POLICY,
  readWeddingSetup,
} from "@ai-werewolf-arena/game-text";
import { validateGhostBrideRecord } from "./ghost_bride_record";
import {
  readLonelyGirlEventFact,
  readLonelyGirlChoiceTool,
  LONELY_GIRL_POLICY,
} from "@ai-werewolf-arena/game-text";
import { readShapeshifterChoiceTool } from "@ai-werewolf-arena/game-text";
import { SHAPESHIFTER_EVENT_TYPES, readShapeshifterEventFact } from "@ai-werewolf-arena/game-text";
import { readWildChildEventFact, WILD_CHILD_EVENT_TYPES } from "@ai-werewolf-arena/game-text";
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
  assertRequestDelivery,
  deferRequestDelivery,
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
  faultPlan?: FaultPlan;
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
  ghostBrideSetup?: import("@ai-werewolf-arena/game-text").WeddingSetup;
  lonelyGirlSetup?: {
    policy: "awa_netease_lonely_girl_v1";
    status: "pending" | "complete" | "cancelled" | "failed";
    actorId: number;
  };
  thiefSetup?: {
    policy: "lui_meme_thief_two_extra_villagers_v1";
    status: "pending" | "complete" | "cancelled" | "failed";
    hands: Array<{ actorId: number; cardId: string; role: Role }>;
    reserve: [{ cardId: string; role: Role }, { cardId: string; role: Role }];
    selection: { actorId: number; slot: 0 | 1 | null; role: Role } | null;
  };
  shapeshifterSetup?: {
    policy: "awa_netease_shapeshifter_two_extra_villagers_v1";
    status: "pending" | "complete" | "cancelled" | "failed";
    hands: Array<{ actorId: number; cardId: string; role: Role }>;
    reserve: [{ cardId: string; role: Role }, { cardId: string; role: Role }];
    selection: { actorId: number; slot: 0 | 1; role: Role } | null;
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
    proposedWitnessId: positive.optional(),
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
    swap_candidates: z.array(positive).optional(),
    shoot_candidates: z.array(positive).optional(),
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
const shapeshifterSetupSchema = thiefSetupSchema.extend({
  policy: z.literal("awa_netease_shapeshifter_two_extra_villagers_v1"),
  selection: z
    .strictObject({
      actorId: positive,
      slot: z.union([z.literal(0), z.literal(1)]),
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
    faultPlan: z.unknown().transform(readFaultPlan).optional(),
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
          shapeshifterSetup: shapeshifterSetupSchema.optional(),
          ghostBrideSetup: z
            .strictObject({
              policy: z.literal(GHOST_BRIDE_POLICY),
              status: z.enum(["pending", "active", "paired", "complete", "failed", "cancelled"]),
              actorId: positive,
              groomId: positive.nullable(),
              witnessId: positive.nullable(),
              witnessVotes: z
                .array(z.strictObject({ actorId: positive, targetId: positive }))
                .max(2),
            })
            .refine((value) => readWeddingSetup(value) !== null)
            .optional(),
          lonelyGirlSetup: z
            .strictObject({
              policy: z.literal(LONELY_GIRL_POLICY),
              status: z.enum(["pending", "complete", "failed", "cancelled"]),
              actorId: positive,
            })
            .optional(),
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
        if (event.type === "order_prince_choice_committed") {
          const fact = readOrderPrinceChoiceFact(event.type, event.payload);
          if (!fact || event.audience?.length !== 1 || event.audience[0] !== fact.actorId)
            ctx.addIssue({ code: "custom", message: "reproduction_order_prince_audience_invalid" });
        }
        if (
          event.type === "order_prince_revote_started" &&
          (!readOrderPrinceRevoteFact(event.type, event.payload) || event.audience !== undefined)
        )
          ctx.addIssue({ code: "custom", message: "reproduction_order_prince_reveal_invalid" });
        if (event.type === "magician_exchange_committed") {
          const fact = readMagicianExchangeFact(event.type, event.payload);
          if (!fact || event.audience?.length !== 1 || event.audience[0] !== fact.actorId)
            ctx.addIssue({ code: "custom", message: "reproduction_magician_audience_invalid" });
        }
        if (
          event.type === "death_shot_missed" &&
          (!readDeathShotMissFact(event.type, event.payload) || event.audience !== undefined)
        )
          ctx.addIssue({ code: "custom", message: "reproduction_magician_shot_miss_invalid" });
        if (event.type === "nightmare_fear_committed") {
          const fact = readNightmareFearFact(event.type, event.payload);
          if (!fact || event.audience?.length !== 1 || event.audience[0] !== fact.actorId)
            ctx.addIssue({ code: "custom", message: "reproduction_nightmare_audience_invalid" });
        }

        if (
          event.audience !== undefined &&
          !(WOLF_TEAM_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(GHOST_BRIDE_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(DEMON_HUNTER_EVENT_TYPES as readonly string[]).includes(event.type) &&
          event.type !== "nightmare_fear_committed" &&
          event.type !== "order_prince_choice_committed" &&
          event.type !== "magician_exchange_committed"
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
  validateInitialIdentityRecord(result);
  validateWildChildRecord(result);
  validateLonelyGirlRecord(result);
  validateGhostBrideRecord(result);
  validateDemonHunterRecord(result);
  validateMagicianRecord(result);
  validateOrderPrinceRecord(result);
  return result;
}

export function normalizedRequest(request: ActionRequest): Omit<ActionRequest, "deadlineAtMs"> {
  const { deadlineAtMs: _deadline, ...facts } = request;
  return structuredClone(facts);
}

/** Copy provider data without invoking getters, proxies, or custom serialization. */
function copyDecisionData(value: unknown, depth = 0): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
  if (
    !value ||
    typeof value !== "object" ||
    depth > 32 ||
    types.isProxy(value) ||
    Object.getOwnPropertySymbols(value).length
  )
    throw new Error("reproduction_action_not_data");
  const array = Array.isArray(value),
    proto = Object.getPrototypeOf(value);
  if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
    throw new Error("reproduction_action_not_plain");
  const fields = Object.getOwnPropertyDescriptors(value),
    copy: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (array && key === "length") continue;
    if (!field.enumerable || !Object.hasOwn(field, "value"))
      throw new Error("reproduction_action_accessor");
    Object.defineProperty(copy, key, {
      value: copyDecisionData(field.value, depth + 1),
      enumerable: true,
    });
  }
  if (!array) return copy;
  const length = fields.length?.value;
  if (
    !Number.isSafeInteger(length) ||
    length > 1024 ||
    Object.keys(copy).length !== length ||
    !Array.from({ length }, (_, i) => Object.hasOwn(copy, i)).every(Boolean)
  )
    throw new Error("reproduction_action_array");
  return Array.from({ length }, (_, i) => copy[i]);
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
      const recordedAction = copyDecisionData(action) as ToolCall | null;
      assertRequestDelivery(request);
      const settle = (accepted: boolean) => {
        entry.outcome = accepted
          ? { kind: "action", action: recordedAction }
          : { kind: "error", code: "decision_failed", name: "Error" };
        entry.settleOrder = ++this.settled;
        this.onChange();
      };
      if (!deferRequestDelivery(request, settle)) settle(true);
      return recordedAction;
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
function validateInitialIdentityRecord(record: ReproductionRecord): void {
  const m = record.metadata,
    hasThief = m.normalizedBoard.roleSetups.some((row) => row.role === Role.Thief && row.count > 0),
    hasShape = m.normalizedBoard.roleSetups.some(
      (row) => row.role === Role.Shapeshifter && row.count > 0,
    ),
    identity = hasShape ? Role.Shapeshifter : Role.Thief;
  if (hasShape && hasThief) throw new Error("reproduction_initial_identity_owners_invalid");
  const fail = () => {
    throw new Error(
      hasShape ? "reproduction_shapeshifter_state_invalid" : "reproduction_thief_state_invalid",
    );
  };
  if (
    !hasShape &&
    (record.events.some((e) => (SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(e.type)) ||
      record.decisions.some(
        (d) =>
          d.stage === "shapeshifter" ||
          d.request.context.stage === "shapeshifter" ||
          d.request.allowedTools.includes("choose_shapeshifter_card") ||
          (d.outcome.kind === "action" && d.outcome.action?.name === "choose_shapeshifter_card"),
      ) ||
      record.checkpoints.some((c) =>
        c.players.some((p) => p.privateState.shapeshifter !== undefined),
      ))
  )
    fail();
  if (!hasThief && !hasShape) {
    if (
      m.initialDeal !== undefined ||
      record.checkpoints.some(
        (c) => c.thiefSetup !== undefined || c.shapeshifterSetup !== undefined,
      ) ||
      record.events.some((e) => (SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(e.type))
    )
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
    initial.filter((role) => role === identity).length !== 1
  )
    fail();
  const supported = [
    identity,
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
  const actorIndex = initial.slice(0, n).indexOf(identity),
    actorId = actorIndex < 0 ? null : m.players[actorIndex]!.id;
  const originalIds = Array.from({ length: n + 2 }, (_, i) => `deal:${i}`);
  let previousStatus: string | undefined, previousSelection: string | undefined;
  for (const checkpoint of record.checkpoints) {
    if (hasShape ? checkpoint.thiefSetup !== undefined : checkpoint.shapeshifterSetup !== undefined)
      fail();
    const state = hasShape ? checkpoint.shapeshifterSetup : checkpoint.thiefSetup;
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
          ? selection.role !== identity
          : selection.role !== initial[n + selection.slot]))
    )
      fail();
    if (selection?.slot === null && initial[n] === Role.Wolf && initial[n + 1] === Role.Wolf)
      fail();
    if (
      hasShape &&
      selection &&
      (selection.slot === null ||
        ([initial[n], initial[n + 1]].includes(Role.Wolf) && selection.role !== Role.Wolf))
    )
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
  if (hasShape) {
    if (
      record.decisions.some(
        (d) =>
          d.stage === "thief" ||
          d.request.context.stage === "thief" ||
          d.request.allowedTools.includes("choose_thief_card") ||
          (d.outcome.kind === "action" && d.outcome.action?.name === "choose_thief_card"),
      )
    )
      fail();
    const facts = record.events.filter((e) =>
      (SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(e.type),
    );
    if (
      record.events.some(
        (e) => e.type === "thief_initial_deal" || e.type === "thief_identity_chosen",
      ) ||
      facts.some((e) => !readShapeshifterEventFact(e.type, e.payload))
    )
      fail();
    const deals = facts.filter((e) => e.type === "shapeshifter_initial_deal"),
      choices = facts.filter((e) => e.type === "shapeshifter_identity_chosen"),
      decisions = record.decisions.filter(
        (d) =>
          d.stage === "shapeshifter" ||
          d.request.context.stage === "shapeshifter" ||
          d.request.allowedTools.includes("choose_shapeshifter_card") ||
          (d.outcome.kind === "action" && d.outcome.action?.name === "choose_shapeshifter_card"),
      );
    if (
      deals.length !== 1 ||
      JSON.stringify(deals[0]!.payload.roles) !== JSON.stringify(initial) ||
      deals[0]!.payload.boardSize !== n ||
      choices.length > 1 ||
      decisions.length > (actorId === null ? 0 : 1)
    )
      fail();
    if (
      decisions.some(
        (d) =>
          d.stage !== "shapeshifter" ||
          d.actorId !== actorId ||
          d.request.actorId !== d.actorId ||
          d.request.context.day !== d.day ||
          d.request.context.stage !== "shapeshifter" ||
          d.day !== 1 ||
          d.request.phase !== Phase.Night ||
          d.request.allowedTools.length !== 1 ||
          d.request.allowedTools[0] !== "choose_shapeshifter_card" ||
          d.request.context.allow_fallback !== false ||
          d.request.context.action_failure_policy !== "error" ||
          d.request.context.turn_constraints.min_valid_actions !== 1 ||
          d.request.context.turn_constraints.max_valid_actions !== 1 ||
          JSON.stringify(d.request.context.turn_constraints.required_any_tools) !==
            JSON.stringify(["choose_shapeshifter_card"]),
      )
    )
      fail();
    if (choices.length) {
      const choice = choices[0]!.payload,
        decision = decisions[0],
        call =
          decision?.outcome.kind === "action"
            ? readShapeshifterChoiceTool(decision.outcome.action)
            : null;
      if (
        !decision ||
        decision.outcome.kind !== "action" ||
        !call ||
        call.args.slot !== choice.slot ||
        choice.actorId !== actorId ||
        choice.role !== initial![n + (choice.slot as number)] ||
        ([initial![n], initial![n + 1]].includes(Role.Wolf) && choice.role !== Role.Wolf)
      )
        fail();
    }
    for (const checkpoint of record.checkpoints) {
      const state = checkpoint.shapeshifterSetup!,
        selection = state.selection;
      const seen = record.events
        .slice(0, checkpoint.eventCount)
        .filter((e) => e.type === "shapeshifter_identity_chosen");
      if (
        seen.length !== (selection ? 1 : 0) ||
        (selection &&
          (seen[0]!.payload.slot !== selection.slot ||
            seen[0]!.payload.actorId !== selection.actorId))
      )
        fail();
      for (const player of checkpoint.players) {
        const expectedCamp = player.role === Role.Wolf ? Camp.Wolf : Camp.Good;
        if (
          JSON.stringify(player.victory.affiliations) !==
          JSON.stringify([{ kind: "faction", faction: expectedCamp }])
        )
          fail();
        const resource = player.privateState.shapeshifter;
        if (player.role === Role.Shapeshifter) {
          if (
            !resource ||
            typeof resource !== "object" ||
            Array.isArray(resource) ||
            Object.keys(resource).sort().join(",") !== "choice,policy,remaining" ||
            (resource as any).policy !== "awa_netease_shapeshifter_two_extra_villagers_v1" ||
            (resource as any).choice !== null ||
            (resource as any).remaining !== (state.status === "pending" ? 1 : 0)
          )
            fail();
        } else if (resource !== undefined) fail();
      }
    }
  }
}

/** AWA finite Wild Child causal state: original identity is immutable; only committed facts move faction. */
function validateWildChildRecord(record: ReproductionRecord): void {
  const has = record.metadata.normalizedBoard.roleSetups.some(
    (row) => row.role === Role.WildChild && row.count === 1,
  );
  const fail: () => never = () => {
    throw new Error("reproduction_wild_child_state_invalid");
  };
  const facts = record.events.filter((e) =>
    (WILD_CHILD_EVENT_TYPES as readonly string[]).includes(e.type),
  );
  if (!has) {
    if (
      facts.length ||
      record.checkpoints.some((c) => c.players.some((p) => p.privateState.wildChild !== undefined))
    )
      fail();
    return;
  }
  const initial = record.metadata.players.filter((p) => p.role === Role.WildChild);
  if (
    initial.length !== 1 ||
    initial[0]!.camp !== Camp.Good ||
    !record.metadata.players.some((p) => p.role === Role.Wolf && p.camp === Camp.Wolf)
  )
    fail();
  const actorId = initial[0]!.id,
    ids = new Set(record.metadata.players.map((p) => p.id));
  let choice: { day: 1; targetId: number } | null = null,
    eligible: number | null = null,
    active: number | null = null,
    camp = Camp.Good;
  let cause: Record<string, unknown> | null = null,
    chosen = false,
    transformed = false,
    activated = false;
  const byCount = new Map<
    number,
    {
      choice: { day: 1; targetId: number } | null;
      eligible: number | null;
      active: number | null;
      camp: Camp;
      status: string;
    }
  >();
  byCount.set(0, { choice, eligible, active, camp, status: "pending" });
  const choiceDecisions = record.decisions.filter((d) => d.stage === "wild_child");
  if (
    choiceDecisions.length > 1 ||
    choiceDecisions.some(
      (d) =>
        d.actorId !== actorId ||
        d.day !== 1 ||
        d.request.phase !== Phase.Night ||
        d.request.context.allow_fallback !== false ||
        d.request.context.turn_constraints.min_valid_actions !== 1,
    )
  )
    fail();
  type NativeDeath = {
    root: number;
    wave: number;
    day: number;
    sources: readonly unknown[];
    phase: Phase;
  };
  const nativeDeaths = new Map<number, NativeDeath>();
  const nightOps = record.operations.filter(
    (op) => op.scope === "resolution" && op.op === "night_damage_resolved",
  );
  let nightIndex = 0;
  let eventDay = 1,
    eventPhase: Phase = Phase.Night;
  for (let index = 0; index < record.events.length; index++) {
    const event = record.events[index]!;
    if (event.type === "phase_changed") {
      eventDay = event.payload.day as number;
      eventPhase = event.payload.phase as Phase;
    }
    if (event.type === "night_resolved") {
      const output = nightOps[nightIndex++]?.output,
        deaths = event.payload.deaths;
      if (
        !Array.isArray(deaths) ||
        (record.finalized && (!output || !Array.isArray(output.deaths)))
      )
        fail();
      const sourceMap = output?.death_sources as Record<string, unknown> | undefined;
      for (const id of deaths as number[]) {
        const sources = sourceMap?.[id];
        if (
          record.finalized &&
          (!Array.isArray(sources) || !sources.length || !(output!.deaths as number[]).includes(id))
        )
          fail();
        nativeDeaths.set(id, {
          root: index,
          wave: 0,
          day: eventDay,
          sources: record.finalized ? (sources as unknown[]) : [],
          phase: Phase.Night,
        });
      }
    }
    if (event.type === "voted_out" && typeof event.payload.target === "number")
      nativeDeaths.set(event.payload.target, {
        root: index,
        wave: 0,
        day: eventDay,
        sources: ["exile"],
        phase: Phase.Voting,
      });
    if (event.type === "wolf_self_destruct" && typeof event.payload.wolfId === "number")
      nativeDeaths.set(event.payload.wolfId, {
        root: index,
        wave: 0,
        day: eventDay,
        sources: ["self_destruct"],
        phase: eventPhase,
      });
    if (
      event.type === "hunter_shot" &&
      typeof event.payload.hunterId === "number" &&
      typeof event.payload.targetId === "number"
    ) {
      const source = nativeDeaths.get(event.payload.hunterId);
      if (source && source.day === eventDay)
        nativeDeaths.set(event.payload.targetId, {
          ...source,
          wave: source.wave + 1,
          sources: ["shot"],
          phase: eventPhase,
        });
    }
    if ((WILD_CHILD_EVENT_TYPES as readonly string[]).includes(event.type)) {
      const p = readWildChildEventFact(event.type, event.payload);
      if (!p || p.actorId !== actorId) fail();
      if (event.type === "wild_child_model_chosen") {
        if (
          chosen ||
          eventDay !== 1 ||
          eventPhase !== Phase.Night ||
          !ids.has(p.targetId as number)
        )
          fail();
        const decision = choiceDecisions[0];
        if (
          !decision ||
          decision.outcome.kind !== "action" ||
          decision.outcome.action?.name !== "choose_wild_model" ||
          decision.outcome.action.args.target_id !== p.targetId
        )
          fail();
        chosen = true;
        choice = { day: 1, targetId: p.targetId as number };
      } else if (event.type === "wild_child_model_eliminated") {
        if (
          !choice ||
          cause ||
          p.targetId !== choice.targetId ||
          (p.deadIds as number[]).some((id) => !ids.has(id))
        )
          fail();
        const actual = nativeDeaths.get(p.targetId as number);
        if (
          !actual ||
          actual.day !== p.day ||
          actual.phase !== p.phase ||
          (record.finalized &&
            JSON.stringify([...actual.sources].sort()) !==
              JSON.stringify([...(p.sources as string[])].sort()))
        )
          fail();
        const wave = [...nativeDeaths]
          .filter(
            ([, d]) => d.root === actual.root && d.wave === actual.wave && d.day === actual.day,
          )
          .map(([id]) => id)
          .sort((a, b) => a - b);
        if (
          JSON.stringify(wave) !==
          JSON.stringify([...(p.deadIds as number[])].sort((a, b) => a - b))
        )
          fail();
        cause = p;
      } else if (event.type === "wild_child_transformed") {
        if (
          !choice ||
          !cause ||
          transformed ||
          p.deathCommit !== cause.deathCommit ||
          p.day !== cause.day ||
          (cause.deadIds as number[]).includes(actorId) ||
          eventDay !== p.day
        )
          fail();
        transformed = true;
        eligible = p.eligibleNight as number;
        camp = Camp.Wolf;
      } else {
        if (
          !transformed ||
          activated ||
          eventPhase !== Phase.Night ||
          p.eligibleNight !== eligible ||
          p.day !== eventDay ||
          eventDay < eligible!
        )
          fail();
        activated = true;
        active = p.day as number;
      }
    }
    byCount.set(index + 1, {
      choice: choice ? { ...choice } : null,
      eligible,
      active,
      camp,
      status: activated ? "active" : transformed ? "transformed" : chosen ? "chosen" : "pending",
    });
  }
  for (const checkpoint of record.checkpoints) {
    const player = checkpoint.players.find((p) => p.id === actorId),
      expected = byCount.get(checkpoint.eventCount);
    if (
      !player ||
      !expected ||
      player.role !== Role.WildChild ||
      player.camp !== expected.camp ||
      JSON.stringify(player.victory.affiliations) !==
        JSON.stringify([{ kind: "faction", faction: expected.camp }])
    )
      fail();
    const state = player.privateState.wildChild as Record<string, unknown> | undefined;
    if (
      !state ||
      Object.keys(state).sort().join(",") !==
        ["policy", "remaining", "status", "choice", "eligibleNight", "activeFromNight"]
          .sort()
          .join(",") ||
      state.policy !== "awa_lui_meme_wild_child_v1" ||
      JSON.stringify(state.choice) !== JSON.stringify(expected.choice) ||
      state.eligibleNight !== expected.eligible ||
      state.activeFromNight !== expected.active
    )
      fail();
    const closed = expected.status === "pending" && checkpoint.cycle > 0 && !checkpoint.complete;
    if (
      state.status !== (closed ? "closed" : expected.status) ||
      state.remaining !== (expected.status === "pending" && !closed ? 1 : 0) ||
      (checkpoint.cycle === 0 && (expected.status !== "pending" || !player.alive)) ||
      (checkpoint.complete && checkpoint.cycle > 0 && expected.status === "pending")
    )
      fail();
  }
}

function validateLonelyGirlRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard,
    owner = board.roleSetups.some((row) => row.role === Role.LonelyGirl && row.count > 0),
    facts = record.events.filter((e) => e.type === "lonely_girl_admired_chosen"),
    decisions = record.decisions.filter(
      (d) =>
        d.stage === "lonely_girl" ||
        d.request.context.stage === "lonely_girl" ||
        d.request.allowedTools.includes("choose_admired_player") ||
        (d.outcome.kind === "action" && d.outcome.action?.name === "choose_admired_player"),
    );
  const fail = () => {
    throw new Error("reproduction_lonely_girl_state_invalid");
  };
  if (!owner) {
    if (
      facts.length ||
      decisions.length ||
      record.metadata.players.some((p) => p.role === Role.LonelyGirl) ||
      record.checkpoints.some(
        (c) =>
          c.lonelyGirlSetup !== undefined ||
          c.players.some((p) => Object.hasOwn(p.privateState, "lonelyGirl")),
      )
    )
      fail();
    return;
  }
  const initial = record.metadata.players.filter((p) => p.role === Role.LonelyGirl),
    actor = initial[0];
  if (
    initial.length !== 1 ||
    !actor ||
    actor.camp !== Camp.Good ||
    record.metadata.initialDeal !== undefined ||
    board.boardSize < 6 ||
    JSON.stringify(
      board.winConditions?.length
        ? board.winConditions
        : [board.winCondition ?? WinCondition.SlaughterCity],
    ) !== JSON.stringify([WinCondition.SlaughterCity]) ||
    board.events ||
    !board.roleSetups.some((row) => row.role === Role.Wolf && row.count > 0) ||
    board.roleSetups.some(
      (row) =>
        ![
          Role.LonelyGirl,
          Role.Wolf,
          Role.Villager,
          Role.Seer,
          Role.Witch,
          Role.Hunter,
          Role.Guard,
          Role.Idiot,
        ].includes(row.role),
    ) ||
    facts.length > 1 ||
    decisions.length > 1 ||
    record.events.some(
      (e) => e.type === "hybrid_exemplar_chosen" || e.type === "hybrid_affiliation_resolved",
    ) ||
    record.decisions.some(
      (d) =>
        d.stage === "hybrid" ||
        d.request.context.stage === "hybrid" ||
        d.request.allowedTools.includes("choose_exemplar") ||
        (d.outcome.kind === "action" && d.outcome.action?.name === "choose_exemplar"),
    )
  )
    fail();
  for (const d of decisions) {
    const c = d.request.context.turn_constraints;
    if (
      d.actorId !== actor.id ||
      d.request.actorId !== actor.id ||
      d.day !== 1 ||
      d.request.context.day !== 1 ||
      d.stage !== "lonely_girl" ||
      d.request.context.stage !== "lonely_girl" ||
      d.request.phase !== Phase.Night ||
      d.request.allowedTools.length !== 1 ||
      d.request.allowedTools[0] !== "choose_admired_player" ||
      c.min_valid_actions !== 1 ||
      c.max_valid_actions !== 1 ||
      JSON.stringify(c.required_any_tools) !== JSON.stringify(["choose_admired_player"]) ||
      d.request.context.allow_fallback !== false ||
      d.request.context.action_failure_policy !== "error"
    )
      fail();
  }
  const fact = facts[0],
    p = fact && readLonelyGirlEventFact(fact.type, fact.payload),
    decision = decisions[0],
    call =
      decision?.outcome.kind === "action"
        ? readLonelyGirlChoiceTool(decision.outcome.action)
        : null,
    target = p && record.metadata.players.find((row) => row.id === p.targetId);
  if (
    fact &&
    (!p ||
      !p.camp ||
      p.actorId !== actor.id ||
      !target ||
      target.camp !== p.camp ||
      !call ||
      call.args.target_id !== p.targetId)
  )
    fail();
  if (
    record.metadata.players.some(
      (player) => player.camp !== (player.role === Role.Wolf ? Camp.Wolf : Camp.Good),
    )
  )
    fail();
  // In-flight flushes carry current decisions but only the last completed cycle's events.
  // The initial pending checkpoint may therefore precede the first choice fact.
  // Finalized records and every post-setup checkpoint must contain that fact.
  if (
    !facts.length &&
    record.decisions.some((d) => !decisions.includes(d)) &&
    (record.finalized || record.checkpoints.some((c) => c.cycle > 0))
  )
    fail();
  let completed = false,
    closed = false,
    finalStatus: string | null = null;
  for (const checkpoint of record.checkpoints) {
    const setup = checkpoint.lonelyGirlSetup,
      player = checkpoint.players.find((row) => row.id === actor.id),
      visible = record.events
        .slice(0, checkpoint.eventCount)
        .some((e) => e.type === "lonely_girl_admired_chosen");
    if (
      checkpoint.players.some((player) => {
        const initial = record.metadata.players.find((p) => p.id === player.id);
        return !initial || player.role !== initial.role || player.camp !== initial.camp;
      })
    )
      fail();
    if (
      !setup ||
      !player ||
      setup.actorId !== actor.id ||
      player.role !== Role.LonelyGirl ||
      player.camp !== Camp.Good ||
      checkpoint.players.some(
        (row) => row.id !== actor.id && Object.hasOwn(row.privateState, "lonelyGirl"),
      ) ||
      checkpoint.players.some((row) => Object.hasOwn(row.privateState, "hybrid"))
    )
      fail();
    if (checkpoint.cycle === 0 && (setup!.status !== "pending" || visible || !checkpoint.complete))
      fail();
    if (checkpoint.cycle > 0 && setup!.status === "pending") fail();
    if (setup!.status === "failed" && checkpoint.complete) fail();
    if (finalStatus && setup!.status !== finalStatus) fail();
    if (setup!.status !== "pending") finalStatus = setup!.status;
    const state = player!.privateState.lonelyGirl as Record<string, unknown> | undefined;
    if (
      !state ||
      Array.isArray(state) ||
      Object.keys(state).length !== 3 ||
      state.policy !== LONELY_GIRL_POLICY
    )
      fail();
    if (visible) {
      if (
        !p ||
        !p.camp ||
        setup!.status !== "complete" ||
        state!.remaining !== 0 ||
        JSON.stringify(state!.choice) !== JSON.stringify({ day: 1, targetId: p.targetId }) ||
        JSON.stringify(player!.victory.affiliations) !==
          JSON.stringify([{ kind: "faction", faction: p.camp }]) ||
        closed
      )
        fail();
      completed = true;
    } else {
      if (
        completed ||
        setup!.status === "complete" ||
        state!.choice !== null ||
        JSON.stringify(player!.victory.affiliations) !== "[]" ||
        state!.remaining !== (setup!.status === "pending" ? 1 : 0)
      )
        fail();
      if (setup!.status !== "pending") closed = true;
      else if (closed) fail();
    }
  }
}
