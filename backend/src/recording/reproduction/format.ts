/**
 * 负责严格复现归档的版本、schema 与原错误名称准入；输入为未知归档数据，输出为已审核的 schema 2／3 Tape。
 * 机制审核交给固定独立 verifier 装配，版本准入、字段形状和第一失败顺序保持。
 * 请求轨迹及其可变游标由 reproduction-trace 单独拥有；此模块不创建 Trace、不执行行动或修改游戏。
 * 精确 source／lock 检查仍由实际 replay 执行；用户原文不经过展示翻译改写。
 */
import {
  WARDEN_EVENT_TYPES,
  readWardenFact,
  wardenFactAudience,
} from "@ai-werewolf-arena/game-contract/facts/warden";

import { unwrapRecordingEnvelope } from "@ai-werewolf-arena/replay-contract";
import { verifyReproductionMechanisms } from "../verification/assembly";
import { animalCheckpointSchema } from "./checkpoint/animal-format";
import {
  ANIMAL_DREAM_EVENT_TYPES,
  readAnimalDreamFact,
  animalDreamFactAudience,
  type AnimalDreamEventType,
} from "@ai-werewolf-arena/game-contract/facts/animal-dream";
import {
  FRAGRANT_PAIR_EVENT_TYPES,
  readFragrantPairFact,
  fragrantPairVisibility,
} from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import { fragrantCheckpointSchema } from "./checkpoint/fragrant-pair-format";
import { nobleBodyCheckpointSchema } from "./checkpoint/noble-body-format";
import { createRecordedPlayerSchema } from "./checkpoint/player-format";
import type { RecordedPlayerState } from "./checkpoint/player-format";
// 持续保留原公共 Tape 类型入口，唯一字段声明与完整玩家格式归同一 owner。
export type { RecordedPlayerState } from "./checkpoint/player-format";
import {
  NOBLE_SECRET_BODY_EVENT_TYPES,
  readNobleSecretBodyFact,
  nobleSecretBodyVisibility,
} from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
import {
  RADIANT_ECLIPSE_EVENT_TYPES,
  readRadiantEclipseFact,
  radiantEclipseAudience,
} from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import {
  MIST_RAVEN_EVENT_TYPES,
  readMistRavenFact,
} from "@ai-werewolf-arena/game-contract/facts/mist-raven";
import {
  readModifierChoiceFact,
  readModifierSkipFact,
  readModifierBonusFact,
  readModifierConflictFact,
} from "@ai-werewolf-arena/game-contract/facts/scholar-mentor";
import {
  readTimeConsortChoiceFact,
  readTimeConsortSkipFact,
  readTimeConsortReflectionFact,
} from "@ai-werewolf-arena/game-contract/facts/time-wolf-consort";
import {
  readWolfSorcererExchangeFact,
  readWolfSorcererSkipFact,
} from "@ai-werewolf-arena/game-contract/facts/wolf-sorcerer";
import {
  readTricksterExchangeFact,
  readTricksterSkipFact,
  readExileMappingFact,
} from "@ai-werewolf-arena/game-contract/facts/trickster";
import {
  readOrderPrinceChoiceFact,
  readOrderPrinceRevoteFact,
} from "@ai-werewolf-arena/game-contract/facts/order-prince";
import {
  SILENCE_ELDER_EVENT_TYPES,
  readSilenceElderFact,
  silenceElderFactAudience,
} from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import {
  AWAKENED_CLAW_EVENT_TYPES,
  readAwakenedClawFact,
} from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import { readCrowFact } from "@ai-werewolf-arena/game-contract";
import { readNightmareFearFact } from "@ai-werewolf-arena/game-contract/facts/nightmare";
import {
  readMagicianExchangeFact,
  readDeathShotMissFact,
} from "@ai-werewolf-arena/game-contract/facts/magician";
import { readFaultPlan, type FaultPlan } from "../../domain/fault-plan";
import { DEMON_HUNTER_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
import {
  GHOST_BRIDE_EVENT_TYPES,
  GHOST_BRIDE_POLICY,
  readWeddingSetup,
} from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import { LONELY_GIRL_POLICY } from "@ai-werewolf-arena/game-contract/facts/lonely-girl";
import { boardConfigSchema } from "@ai-werewolf-arena/game-contract";
import { dictionaries, text, type MessageKey } from "@ai-werewolf-arena/game-text";
import { z } from "zod";
import { readGameOutcome, readVictoryPoint } from "@ai-werewolf-arena/replay-contract";
import type { GameOutcome, VictoryPoint } from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import {
  ACTION_STAGES,
  TOOL_NAMES,
  ActionWindow,
  KnightDuelWindow,
  Camp,
  Phase,
  Role,
  WinCondition,
  WitchSelfHealRule,
  DeathCause,
  type BoardConfig,
  type RuntimeSnapshot,
  type ToolCall,
} from "@ai-werewolf-arena/game-contract";
import { WOLF_TEAM_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/events";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract/requests";
import type { RandomMetadata } from "../../domain/random";

export const REPRODUCTION_SCHEMA_VERSION = 3 as const;
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
    // 原生 DOMException 的内建访问器会校验对象身份；不能调用
    // 外来 name getter，也不能因为之前一次读取成功就信任当前值。
    try {
      const name = nativeDomName?.call(error);
      if (name !== undefined) return accepted(name);
    } catch {
      /* 此对象不是 DOMException。 */
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
    /* 特殊错误对象不能覆盖原始失败。 */
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
export interface RecordedCheckpoint {
  animalDream?: import("./checkpoint/animal-format").RecordedAnimalState;
  fragrantPair?: import("./checkpoint/fragrant-pair-format").RecordedFragrantState;
  nobleBody?: import("./checkpoint/noble-body-format").RecordedNobleBodyState;
  operationCount?: number;
  settlementCount?: number;
  decisionCount?: number;
  ghostBrideSetup?: import("@ai-werewolf-arena/game-contract/facts/ghost-bride").WeddingSetup;
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
  openedAtEventCount?: number;
  /** 仅 Tape3 的 deferred false-close 保存已返回且安全复制的候选；缺席不是 null，也不是付款许可。 */
  returnedCandidate?: ToolCall | null;
  outcome:
    | { kind: "pending" }
    | { kind: "action"; action: ToolCall | null }
    | { kind: "error"; code: "decision_failed"; name: RecordedErrorName };
}
/** 序列化事件证据；历史 audience 可缺省，不代表运行时行动许可。 */
export interface RecordedGameEvent {
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
  audience?: readonly number[];
}
export interface ReproductionRecord {
  schemaVersion: 2 | typeof REPRODUCTION_SCHEMA_VERSION;
  finalized: boolean;
  metadata: ReproductionMetadata;
  decisions: RecordedDecision[];
  checkpoints: RecordedCheckpoint[];
  events: RecordedGameEvent[];
  operations: Array<{
    scope: string;
    op: string;
    actor_id?: number;
    event_count?: number;
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
    death_origin_phase: z.enum(Phase).optional(),
    death_sources: z.array(z.enum(DeathCause)).optional(),
    death_action_id: positive.optional(),
    modifier_modes: z.array(z.enum(["enhance", "weaken"])).optional(),
    mist_candidates: z.array(positive).optional(),
    servant_candidates: z.array(positive).optional(),
    secret_body_candidates: z.array(positive).optional(),
    shelter_candidates: z.array(positive).optional(),
    swallow_candidates: z.array(positive).optional(),
    wolf_kill_candidates: z.array(positive).optional(),
    snake_target: positive.nullable().optional(),
    snake_candidates: z.array(positive).optional(),
    raven_candidates: z.array(positive).optional(),
    modifier_candidates: z.array(positive).optional(),
    modifier_bonus_kind: z.enum(["check", "guard", "poison", "kill"]).optional(),
    modifier_bonus_candidates: z.array(positive).optional(),
    wolf_targets: z.array(positive).optional(),
    modifier_poison_blocked: z.boolean().optional(),
    consort_candidates: z.array(positive).optional(),
    sorcerer_candidates: z.array(positive).optional(),
    trickster_candidates: z.array(positive).optional(),
    trickster_may_pass: z.boolean().optional(),
    swap_candidates: z.array(positive).optional(),
    shoot_candidates: z.array(positive).optional(),
    claw_bequest_candidates: z.array(positive).optional(),
    warden_candidates: z.array(z.number().int().positive()).optional(),
    warden_partner_id: z.number().int().positive().optional(),
    warden_forced_target: z.number().int().positive().optional(),
    silence_candidates: z.array(positive).optional(),
    silence_target_id: positive.optional(),
    silence_translator_id: positive.nullable().optional(),
    silence_gesture_description: z.string().min(1).max(8192).optional(),
    silence_round: z.enum(["day", "pk"]).optional(),
    crow_candidates: z.array(positive).optional(),
    fox_candidates: z.array(positive).optional(),
    fragrant_pair_candidates: z.array(positive).optional(),
    pair_check_candidates: z.array(positive).optional(),
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
// 玩家格式在原声明点使用同一正整数和 generic JSON schema；准入仍只发生在 Tape parse。
const playerSchema = createRecordedPlayerSchema(positive, jsonObject);
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
// Tape2 保原严格字段：不接受 returnedCandidate，也不为历史 error 补造候选。
const schema2 = z.strictObject({
  schemaVersion: z.literal(2),
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
      openedAtEventCount: nonnegative.optional(),
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
          animalDream: animalCheckpointSchema.optional(),
          nobleBody: nobleBodyCheckpointSchema.optional(),
          fragrantPair: fragrantCheckpointSchema.optional(),
          operationCount: nonnegative.optional(),
          settlementCount: nonnegative.optional(),
          decisionCount: nonnegative.optional(),
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
        if (
          event.type === "time_consort_lock_committed" ||
          event.type === "time_consort_lock_skipped"
        ) {
          const f =
            readTimeConsortChoiceFact(event.type, event.payload) ??
            readTimeConsortSkipFact(event.type, event.payload);
          if (!f || event.audience?.length !== 1 || event.audience[0] !== f.actorId)
            ctx.addIssue({ code: "custom", message: "reproduction_time_consort_audience_invalid" });
        }
        if (
          event.type === "time_consort_reflected" &&
          (!readTimeConsortReflectionFact(event.type, event.payload) ||
            !Array.isArray(event.audience) ||
            event.audience.length !== 0)
        )
          ctx.addIssue({ code: "custom", message: "reproduction_time_consort_reflection_invalid" });
        if (
          event.type === "wolf_sorcerer_exchange_committed" ||
          event.type === "wolf_sorcerer_exchange_skipped"
        ) {
          const fact =
            event.type === "wolf_sorcerer_exchange_committed"
              ? readWolfSorcererExchangeFact(event.type, event.payload)
              : readWolfSorcererSkipFact(event.type, event.payload);
          if (!fact || event.audience?.length !== 1 || event.audience[0] !== fact.actorId)
            ctx.addIssue({
              code: "custom",
              message: "reproduction_wolf_sorcerer_audience_invalid",
            });
        }
        if (
          event.type === "trickster_exchange_committed" ||
          event.type === "trickster_exchange_skipped"
        ) {
          const fact =
            event.type === "trickster_exchange_committed"
              ? readTricksterExchangeFact(event.type, event.payload)
              : readTricksterSkipFact(event.type, event.payload);
          if (!fact || event.audience?.length !== 1 || event.audience[0] !== fact.actorId)
            ctx.addIssue({ code: "custom", message: "reproduction_trickster_audience_invalid" });
        }
        if (
          event.type === "exile_target_mapped" &&
          (!readExileMappingFact(event.type, event.payload) || event.audience !== undefined)
        )
          ctx.addIssue({ code: "custom", message: "reproduction_trickster_mapping_invalid" });
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
        if ((WARDEN_EVENT_TYPES as readonly string[]).includes(event.type)) {
          const f = readWardenFact(event.type, event.payload);
          if (
            !f ||
            (wardenFactAudience(f.type) === "god"
              ? event.audience?.length !== 0
              : event.audience?.length !== 1 || event.audience[0] !== f.payload.actorId)
          )
            ctx.addIssue({ code: "custom", message: "reproduction_warden_fact_invalid" });
        }
        if ((AWAKENED_CLAW_EVENT_TYPES as readonly string[]).includes(event.type)) {
          const fact = readAwakenedClawFact(event.type, event.payload);
          const expected =
            fact?.type === "awakened_claw_bequeathed"
              ? [fact.payload.actorId, fact.payload.targetId].sort((a, b) => a - b)
              : fact?.type === "awakened_claw_spent"
                ? [fact.payload.actorId]
                : [];
          if (
            !fact ||
            !Array.isArray(event.audience) ||
            event.audience.length !== expected.length ||
            !expected.every((id, i) => event.audience![i] === id)
          )
            ctx.addIssue({ code: "custom", message: "reproduction_awakened_claw_fact_invalid" });
        }
        if ((SILENCE_ELDER_EVENT_TYPES as readonly string[]).includes(event.type)) {
          const f = readSilenceElderFact(event.type, event.payload);
          const visibility = f && silenceElderFactAudience(f.type);
          if (
            !f ||
            (visibility === "god"
              ? event.audience?.length !== 0
              : visibility === "actor"
                ? !("actorId" in f.payload) ||
                  event.audience?.length !== 1 ||
                  event.audience[0] !== f.payload.actorId
                : event.audience !== undefined)
          )
            ctx.addIssue({ code: "custom", message: "reproduction_silence_fact_invalid" });
        }
        if (event.type === "crow_curse_chosen" || event.type === "crow_curse_applied") {
          const f = readCrowFact(event.type, event.payload);
          if (
            !f ||
            ("actorId" in f
              ? event.audience?.length !== 1 || event.audience[0] !== f.actorId
              : event.audience !== undefined)
          )
            ctx.addIssue({ code: "custom", message: "reproduction_crow_fact_invalid" });
        }
        if (event.type === "nightmare_fear_committed") {
          const fact = readNightmareFearFact(event.type, event.payload);
          if (!fact || event.audience?.length !== 1 || event.audience[0] !== fact.actorId)
            ctx.addIssue({ code: "custom", message: "reproduction_nightmare_audience_invalid" });
        }

        if (
          [
            "modifier_choice_committed",
            "modifier_choice_skipped",
            "modifier_bonus_resolved",
          ].includes(event.type)
        ) {
          const fact =
            event.type === "modifier_choice_committed"
              ? readModifierChoiceFact(event.type, event.payload)
              : event.type === "modifier_choice_skipped"
                ? readModifierSkipFact(event.type, event.payload)
                : readModifierBonusFact(event.type, event.payload);
          if (!fact || event.audience?.length !== 1 || event.audience[0] !== fact.actorId)
            ctx.addIssue({ code: "custom", message: "reproduction_modifier_owner_invalid" });
        }
        if (
          event.type === "modifier_conflict_resolved" &&
          (!readModifierConflictFact(event.type, event.payload) || event.audience?.length !== 0)
        )
          ctx.addIssue({ code: "custom", message: "reproduction_modifier_conflict_invalid" });
        if ((ANIMAL_DREAM_EVENT_TYPES as readonly string[]).includes(event.type)) {
          const fact = readAnimalDreamFact(event.type, event.payload),
            audience = animalDreamFactAudience(event.type as AnimalDreamEventType);
          if (
            !fact ||
            (audience === "public"
              ? event.audience !== undefined
              : audience === "god"
                ? event.audience?.length !== 0
                : event.audience?.length !== 1 ||
                  event.audience[0] !==
                    ("actorId" in fact.payload ? fact.payload.actorId : undefined))
          )
            ctx.addIssue({ code: "custom", message: "reproduction_animal_fact_invalid" });
        }
        if ((FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(event.type)) {
          const fact = readFragrantPairFact(event.type, event.payload),
            visibility = fragrantPairVisibility(event.type);
          if (
            !fact ||
            (visibility === "god"
              ? event.audience?.length !== 0
              : event.audience?.length !== 1 || event.audience[0] !== fact.actorId)
          )
            ctx.addIssue({ code: "custom", message: "reproduction_fragrant_fact_invalid" });
        }
        if ((NOBLE_SECRET_BODY_EVENT_TYPES as readonly string[]).includes(event.type)) {
          const fact = readNobleSecretBodyFact(event.type, event.payload),
            visibility = nobleSecretBodyVisibility(event.type);
          if (
            !fact ||
            (visibility === "god"
              ? event.audience?.length !== 0
              : visibility === "actor"
                ? event.audience?.length !== 1 || event.audience[0] !== fact.actorId
                : event.audience !== undefined)
          )
            ctx.addIssue({
              code: "custom",
              message: "reproduction_noble_secret_body_fact_invalid",
            });
        }
        if ((RADIANT_ECLIPSE_EVENT_TYPES as readonly string[]).includes(event.type)) {
          const fact = readRadiantEclipseFact(event.type, event.payload),
            expected = fact ? radiantEclipseAudience(event.type, fact) : null;
          if (
            !expected ||
            !Array.isArray(event.audience) ||
            event.audience.length !== expected.length ||
            !expected.every((id, i) => event.audience![i] === id)
          )
            ctx.addIssue({ code: "custom", message: "reproduction_radiant_eclipse_fact_invalid" });
        }
        if ((MIST_RAVEN_EVENT_TYPES as readonly string[]).includes(event.type)) {
          const fact = readMistRavenFact(event.type, event.payload);
          if (
            !fact ||
            ("actorId" in fact &&
              (event.audience?.length !== 1 || event.audience[0] !== fact.actorId))
          )
            ctx.addIssue({ code: "custom", message: "reproduction_mist_raven_fact_invalid" });
        }
        if (
          event.audience !== undefined &&
          !(ANIMAL_DREAM_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(NOBLE_SECRET_BODY_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(RADIANT_ECLIPSE_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(MIST_RAVEN_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(WOLF_TEAM_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(GHOST_BRIDE_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(DEMON_HUNTER_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(AWAKENED_CLAW_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(WARDEN_EVENT_TYPES as readonly string[]).includes(event.type) &&
          !(SILENCE_ELDER_EVENT_TYPES as readonly string[]).includes(event.type) &&
          event.type !== "crow_curse_chosen" &&
          event.type !== "nightmare_fear_committed" &&
          event.type !== "modifier_choice_committed" &&
          event.type !== "modifier_choice_skipped" &&
          event.type !== "modifier_conflict_resolved" &&
          event.type !== "modifier_bonus_resolved" &&
          event.type !== "time_consort_lock_committed" &&
          event.type !== "time_consort_lock_skipped" &&
          event.type !== "time_consort_reflected" &&
          event.type !== "wolf_sorcerer_exchange_committed" &&
          event.type !== "wolf_sorcerer_exchange_skipped" &&
          event.type !== "trickster_exchange_committed" &&
          event.type !== "trickster_exchange_skipped" &&
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
      event_count: nonnegative.optional(),
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

/** Tape3 只扩充明确的返回候选事实；旧字段与 outcome 仍复用原严格结构。 */
const schema3 = schema2.extend({
  schemaVersion: z.literal(REPRODUCTION_SCHEMA_VERSION),
  decisions: z.array(
    z.preprocess(
      (value, ctx) => {
        if (value && typeof value === "object") {
          const field = Object.getOwnPropertyDescriptor(value, "returnedCandidate");
          // 新字段只接纳自身可枚举数据。继承值、accessor、undefined 不能伪装成显式 null。
          if (
            (field && (!field.enumerable || !("value" in field) || field.value === undefined)) ||
            (!field && "returnedCandidate" in value)
          ) {
            ctx.addIssue({ code: "custom", message: "reproduction_returned_candidate_invalid" });
            return z.NEVER;
          }
        }
        return value;
      },
      schema2.shape.decisions.element
        .extend({
          returnedCandidate: z
            .strictObject({ name: z.enum(TOOL_NAMES), args: jsonObject })
            .nullable()
            .optional(),
        })
        .superRefine((decision, ctx) => {
          if (
            Object.hasOwn(decision, "returnedCandidate") &&
            (decision.outcome.kind !== "error" || decision.outcome.name !== "Error")
          )
            ctx.addIssue({ code: "custom", message: "reproduction_returned_candidate_invalid" });
        }),
    ),
  ),
});

/** 先保版本／严格 envelope 准入，再按固定独立装配审核角色与板子；审核不执行游戏规则。 */
export function parseReproductionRecord(value: unknown): ReproductionRecord {
  // 封装先按显式格式解包；裸 Tape 按捕获版本选严格 schema，历史 Tape2 保原形状与预检读取顺序。
  value = unwrapRecordingEnvelope(value, "strict_reproduction").payload;
  let version: unknown;
  if (value && typeof value === "object" && "schemaVersion" in value) {
    // 保历史裸 Tape2 的一次 in／一次预检读取；schema 选择不再次触发 caller getter。
    version = value.schemaVersion;
    if (version !== 2 && version !== REPRODUCTION_SCHEMA_VERSION)
      throw new Error("reproduction_schema_not_supported");
  }
  const selected = version === 2 ? schema2 : schema3;
  const parsed = selected.safeParse(value);
  if (!parsed.success) throw new Error("reproduction_record_invalid");
  const result = parsed.data as unknown as ReproductionRecord;
  verifyReproductionMechanisms(result);
  return result;
}
