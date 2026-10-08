import { dictionaries, text, type MessageKey } from "@ai-werewolf-arena/game-text";
import { z } from "zod";
import { types } from "node:util";
import { ACTION_STAGES, TOOL_NAMES, ActionWindow, Camp, Phase, Role, WinCondition, WitchSelfHealRule, type ActionProvider, type ActionRequest, type BoardConfig, type GameEvent, type RuntimeSnapshot, type ToolCall } from "../core";
import type { RandomMetadata } from "../core/domain/random";

export const REPRODUCTION_SCHEMA_VERSION = 1 as const;
const ERROR_NAMES = ["Error", "TypeError", "RangeError", "AbortError", "TimeoutError", "AggregateError"] as const;
export type RecordedErrorName = typeof ERROR_NAMES[number];
const FAILURE_SCOPES = ["initialization", "cycle", "cleanup", "recording", "controller"] as const;
export type ReproductionFailureScope = typeof FAILURE_SCOPES[number];
const nativeDomName = Object.getOwnPropertyDescriptor(DOMException.prototype, "name")?.get;
export function recordedErrorName(error: unknown): RecordedErrorName {
  const accepted = (value: unknown): RecordedErrorName => typeof value === "string" && ERROR_NAMES.includes(value as RecordedErrorName) ? value as RecordedErrorName : "Error";
  try {
    if (!error || typeof error !== "object" || types.isProxy(error)) return "Error";
    // Native DOMException has a branded intrinsic accessor. Never call a
    // foreign name getter or trust a value merely because a prior read passed.
    try { const name = nativeDomName?.call(error); if (name !== undefined) return accepted(name); } catch { /* Not a DOMException. */ }
    if (!types.isNativeError(error)) return "Error";
    let current: object | null = error;
    for (let depth = 0; current && depth < 8; depth++) {
      if (types.isProxy(current)) return "Error";
      const descriptor = Object.getOwnPropertyDescriptor(current, "name");
      if (descriptor) return "value" in descriptor ? accepted(descriptor.value) : "Error";
      current = Object.getPrototypeOf(current);
    }
  } catch { /* An exotic error cannot replace the original failure. */ }
  return "Error";
}
export interface EngineVersion { id: "awa-engine"; sourceHash: string; lockHash: string; commit?: string }
export interface ReproductionMetadata {
  engine: EngineVersion;
  random: RandomMetadata;
  ruleset: { id: string; version: string };
  boardId: string;
  normalizedBoard: BoardConfig;
  locale: "zh-CN" | "en";
  maxDays: number;
  dealMode: "random" | "fixed";
  players: Array<{ id: number; name: string; role: Role; camp: Camp; agent?: { kind: "llm" | "acp"; name: string; model?: string } }>;
}
export interface RecordedPlayerState {
  id: number; seat: number; name: string; role: Role; camp: Camp; alive: boolean;
  privateState: Record<string, unknown>; vote: { weight: number; canVote: boolean }; badge: { isSheriff: boolean; destroyed: boolean; voteWeight: number }; marks: string[];
}
export interface RecordedCheckpoint { cycle: number; complete: boolean; snapshot: RuntimeSnapshot; players: RecordedPlayerState[]; eventCount: number; failure?: { name: RecordedErrorName; code: "cycle_failed" } }
export interface RecordedDecision {
  actorId: number; day: number; stage: ActionRequest["context"]["stage"]; turn: number;
  request: Omit<ActionRequest, "deadlineAtMs">;
  settleOrder?: number;
  openedAfterSettlement: number;
  outcome: { kind: "pending" } | { kind: "action"; action: ToolCall | null } | { kind: "error"; code: "decision_failed"; name: RecordedErrorName };
}
export interface ReproductionRecord {
  schemaVersion: typeof REPRODUCTION_SCHEMA_VERSION; finalized: boolean; metadata: ReproductionMetadata;
  decisions: RecordedDecision[]; checkpoints: RecordedCheckpoint[]; events: GameEvent[];
  operations: Array<{ scope: string; op: string; actor_id?: number; phase?: string; status: string; reason?: string; input?: Record<string, unknown>; output?: Record<string, unknown> }>;
  termination: { reason: string; winner: Camp | null; errors: Array<{ scope: ReproductionFailureScope; name: RecordedErrorName }> } | null;
}

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonnegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const jsonObject = z.record(z.string(), z.json());
const strategies = z.enum(["min_id", "min_seat", "no_elimination", "no_kill"]);
const boardSchema = z.strictObject({ boardSize: positive.max(128), enableSheriff: z.boolean(), initialSheriffSeat: positive.optional(),
  winConditions: z.array(z.enum(WinCondition)).optional(), winCondition: z.enum(WinCondition).optional(),
  hooks: z.strictObject({ onDaybreak: z.boolean(), onPreElection: z.boolean(), onPreVote: z.boolean(), onPerSpeechGap: z.boolean() }),
  roleSetups: z.array(z.strictObject({ role: z.enum(Role), count: nonnegative.max(128) })).min(1),
  selfDestruct: z.strictObject({ enabledWindows: z.array(z.enum(ActionWindow)) }).optional(),
  sheriff: z.strictObject({ voteWeight: z.number().finite().positive().optional() }).optional(),
  witch: z.strictObject({ canSelfHeal: z.enum(WitchSelfHealRule).optional() }).optional(),
  tieBreaker: z.strictObject({ exileVote: strategies.optional(), wolfKillVote: strategies.optional(), sheriffVote: strategies.optional() }).optional(),
});
const messageRefSchema = z.strictObject({ key: z.enum(Object.keys(dictionaries["zh-CN"]) as [MessageKey, ...MessageKey[]]), parameters: z.record(z.string(), z.union([z.string(), z.number().finite()])).optional() }).superRefine((message, ctx) => {
  try { text("zh-CN", message.key, message.parameters); }
  catch { ctx.addIssue({ code: "custom", message: "reproduction_message_reference_invalid" }); }
});
const requestSchema = z.strictObject({ actorId: positive, phase: z.enum(Phase), actionWindow: z.enum(ActionWindow).optional(), allowedTools: z.array(z.enum(TOOL_NAMES)),
  context: z.strictObject({ day: positive, stage: z.enum(ACTION_STAGES), visible_events: z.array(z.strictObject({ seq: positive, type: z.string().min(1), payload: jsonObject })),
    turn_constraints: z.strictObject({ min_valid_actions: nonnegative.optional(), max_valid_actions: nonnegative.optional(), required_any_tools: z.array(z.enum(TOOL_NAMES)).optional(), summary: z.string().optional(), summary_message: messageRefSchema.optional() }),
    wolf_target: positive.nullable().optional(), trigger: z.string().optional(), death_phase: z.enum(Phase).optional(), sheriff_candidates: z.array(positive).optional(),
    round: positive.optional(), max_rounds: positive.optional(), retry_attempt: nonnegative.optional(), retry_max: nonnegative.optional(), retry_reason: z.string().optional(), retry_notice: z.string().optional(), retry_notice_message: messageRefSchema.optional(),
  }),
});
const snapshotSchema = z.strictObject({ day: positive, phase: z.enum(Phase), gameOver: z.boolean(), result: z.strictObject({ winner: z.enum(Camp).nullable(), reason: z.string() }).nullable() });
const playerSchema = z.strictObject({ id: positive, seat: positive, name: z.string(), role: z.enum(Role), camp: z.enum(Camp), alive: z.boolean(), privateState: jsonObject,
  vote: z.strictObject({ weight: z.number().finite().nonnegative(), canVote: z.boolean() }),
  badge: z.strictObject({ isSheriff: z.boolean(), destroyed: z.boolean(), voteWeight: z.number().finite().positive() }), marks: z.array(z.string()),
});
const schema = z.strictObject({ schemaVersion: z.literal(REPRODUCTION_SCHEMA_VERSION), finalized: z.boolean(),
  metadata: z.strictObject({ engine: z.strictObject({ id: z.literal("awa-engine"), sourceHash: z.string().regex(/^[a-f0-9]{64}$/), lockHash: z.string().regex(/^[a-f0-9]{64}$/), commit: z.string().regex(/^[a-f0-9]{40}$/).optional() }),
    random: z.strictObject({ seed: z.string().min(1), algorithm: z.string().min(1), streamPolicy: z.string().min(1), path: z.array(z.string()) }),
    ruleset: z.strictObject({ id: z.string().min(1), version: z.string().min(1) }), boardId: z.string().regex(/^[a-z][a-z0-9_-]*$/), normalizedBoard: boardSchema,
    locale: z.enum(["zh-CN", "en"]), maxDays: positive, dealMode: z.enum(["random", "fixed"]),
    players: z.array(z.strictObject({ id: positive, name: z.string(), role: z.enum(Role), camp: z.enum(Camp), agent: z.strictObject({ kind: z.enum(["llm", "acp"]), name: z.string(), model: z.string().optional() }).optional() })).min(1),
  }),
  decisions: z.array(z.strictObject({ actorId: positive, day: positive, stage: z.enum(ACTION_STAGES), turn: positive, request: requestSchema, settleOrder: positive.optional(), openedAfterSettlement: nonnegative,
    outcome: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("pending") }), z.strictObject({ kind: z.literal("action"), action: z.strictObject({ name: z.enum(TOOL_NAMES), args: jsonObject }).nullable() }), z.strictObject({ kind: z.literal("error"), code: z.literal("decision_failed"), name: z.enum(ERROR_NAMES) })]),
  })),
  checkpoints: z.array(z.strictObject({ cycle: nonnegative, complete: z.boolean(), snapshot: snapshotSchema, players: z.array(playerSchema), eventCount: nonnegative, failure: z.strictObject({ name: z.enum(ERROR_NAMES), code: z.literal("cycle_failed") }).optional() })).min(1),
  events: z.array(z.strictObject({ timestamp: z.number().finite(), type: z.string().min(1), payload: jsonObject })),
  operations: z.array(z.strictObject({ scope: z.string(), op: z.string(), actor_id: positive.optional(), phase: z.string().optional(), status: z.string(), reason: z.string().optional(), input: jsonObject.optional(), output: jsonObject.optional() })),
  termination: z.strictObject({ reason: z.string(), winner: z.enum(Camp).nullable(), errors: z.array(z.strictObject({ scope: z.enum(FAILURE_SCOPES), name: z.enum(ERROR_NAMES) })) }).nullable(),
});

/** A serialization boundary: strict envelopes, then runtime validates role and board semantics. */
export function parseReproductionRecord(value: unknown): ReproductionRecord {
  if (value && typeof value === "object" && "schemaVersion" in value && value.schemaVersion !== REPRODUCTION_SCHEMA_VERSION) throw new Error("reproduction_schema_not_supported");
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("reproduction_record_invalid");
  return parsed.data as unknown as ReproductionRecord;
}

export function normalizedRequest(request: ActionRequest): Omit<ActionRequest, "deadlineAtMs"> {
  const { deadlineAtMs: _deadline, ...facts } = request;
  return structuredClone(facts);
}

export class ReproductionTrace {
  private readonly decisions: RecordedDecision[] = [];
  private readonly checkpoints: RecordedCheckpoint[] = [];
  private events: GameEvent[] = [];
  private settled = 0;
  private invalid = false;
  private readonly errors: Array<{ scope: ReproductionFailureScope; name: RecordedErrorName }> = [];
  private readonly turns = new Map<string, number>();
  constructor(private readonly metadata: ReproductionMetadata, private readonly onChange: () => void) { this.metadata = structuredClone(metadata); }

  async decide(request: ActionRequest, provider: ActionProvider): Promise<ToolCall | null> {
    const key = `${request.actorId}/${request.context.day}/${request.context.stage}`;
    const turn = (this.turns.get(key) ?? 0) + 1;
    this.turns.set(key, turn);
    const entry: RecordedDecision = { actorId: request.actorId, day: request.context.day, stage: request.context.stage, turn,
      request: normalizedRequest(request), openedAfterSettlement: this.settled, outcome: { kind: "pending" } };
    this.decisions.push(entry); this.onChange();
    try {
      const action = await provider.getAction(request);
      entry.outcome = { kind: "action", action: structuredClone(action) }; entry.settleOrder = ++this.settled; this.onChange();
      return action;
    } catch (error) {
      // Transport error strings may contain credentials. Preserve a reproducible failure, not its raw message.
      entry.outcome = { kind: "error", code: "decision_failed", name: recordedErrorName(error) }; entry.settleOrder = ++this.settled; this.onChange();
      throw error;
    }
  }

  invalidate(): void { this.invalid = true; this.onChange(); }

  noteFailure(scope: ReproductionFailureScope, error: unknown): void { this.errors.push({ scope, name: recordedErrorName(error) }); this.onChange(); }

  checkpoint(checkpoint: RecordedCheckpoint, events: readonly GameEvent[]): void {
    if (events.length !== checkpoint.eventCount) throw new Error("reproduction_checkpoint_events_mismatch");
    this.checkpoints.push(structuredClone(checkpoint)); this.events = structuredClone([...events]); this.onChange();
  }

  build(input?: { operations: ReproductionRecord["operations"]; termination: { reason: string; winner: Camp | null } }): ReproductionRecord {
    const record = { schemaVersion: REPRODUCTION_SCHEMA_VERSION, finalized: Boolean(input), metadata: this.metadata,
      decisions: this.decisions, checkpoints: this.checkpoints, events: this.events, operations: input?.operations ?? [], termination: input ? { ...input.termination, errors: this.errors } : null };
    if (input && this.invalid) throw new Error("reproduction_trace_incomplete");
    if (input && this.decisions.some(entry => entry.outcome.kind === "pending")) throw new Error("reproduction_decisions_pending");
    return parseReproductionRecord(record);
  }
}
