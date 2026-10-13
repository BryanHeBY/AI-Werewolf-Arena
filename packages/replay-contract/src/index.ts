/**
 * 向后端和浏览器公开原 schema 2 复盘、历史转换与显式封装 reader；输入为纯数据归档。
 * 输出保留原规范化 document，旧未声明／v1／v2 reader 规则与原文不变；新封装身份不表示可执行授权。
 * 游戏结算与严格来源兼容仍由后端实际执行器负责，本出口不导入 Node、World 或 renderer。
 */
import { isRecord, assertField, assertSerializedData, ReplayDocumentValidationError } from "./validation";
export { ReplayDocumentValidationError } from "./validation";
import { isLocale, type Locale, type SealedVictoryResult } from "@ai-werewolf-arena/game-catalog";
import { unwrapRecordingEnvelope, type RecordingIdentities } from "./archive-envelope";
import { readVictoryResult } from "./outcomes";
import {
  legacyPhaseId,
  legacyStageId,
  legacyRoleId,
  legacyCampId,
  legacyResultReasonId,
} from "./legacy_aliases";
export * from "./legacy_aliases";
export const REPLAY_SCHEMA_VERSION = 2 as const;
export * from "./inspection";
export * from "./gravekeeper";
export * from "./outcomes";

/**
 * 浏览器与视频消费的公开复盘数据形状；展示视图不充当已持久化完整归档。
 *
 * `god` 为完整裁判视角，包含每个角色和所有公开事件，
 * 也支持仍进行中的对局；执行来源与版本声明由新 envelope 独立记录。
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
    /** 明确的引擎判胜，与执行结束原因分别记录。 */
    decision?: SealedVictoryResult;
  };
  players: Array<{
    player_id: number;
    role: string;
    camp: string;
    name?: string;
  }>;
  events: ReplayEvent[];
}

/** 校验未筛选的原规范 document，事件序号从一开始；不推导游戏规则。 */
function assertReplayShape(
  value: unknown,
): asserts value is Omit<ReplayDocument, "schemaVersion"> & { schemaVersion?: unknown } {
  if (
    !isRecord(value) ||
    value.perspective !== "god" ||
    typeof value.sessionId !== "string" ||
    !Array.isArray(value.events)
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
  assertField(
    value.result.winner === null || typeof value.result.winner === "string",
    "result.winner",
  );
  assertField(
    value.result.reason === null || typeof value.result.reason === "string",
    "result.reason",
  );

  const playerIds = new Set<number>();
  for (let index = 0; index < value.players.length; index += 1) {
    const player: unknown = value.players[index];
    const path = `players[${index}]`;
    assertField(isRecord(player), path);
    assertField(
      typeof player.player_id === "number" &&
        Number.isSafeInteger(player.player_id) &&
        player.player_id > 0,
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
  const decision = Object.getOwnPropertyDescriptor(value.result, "decision");
  if (decision) {
    assertField("value" in decision && decision.enumerable === true, "result.decision");
    const parsed = readVictoryResult(decision.value, [...playerIds]);
    assertField(parsed.winner === value.result.winner, "result.winner");
  }
  const explicit: SealedVictoryResult[] = [];
  if (decision && "value" in decision)
    explicit.push(readVictoryResult(decision.value, [...playerIds]));
  for (const event of value.events) {
    if (
      event.type !== "game_over" ||
      !isRecord(event.payload) ||
      (!Object.hasOwn(event.payload, "outcome") && !Object.hasOwn(event.payload, "decidedAt"))
    )
      continue;
    assertSerializedData(event.payload, "events.game_over.payload");
    try {
      explicit.push(readVictoryResult(event.payload, [...playerIds]));
    } catch {
      /* 独立非法终局事实继续保留为未知原事件，不生成替代判胜。 */
    }
  }
  if (explicit.length > 1)
    assertField(
      explicit.every((item) => JSON.stringify(item) === JSON.stringify(explicit[0])),
      "result.decision_terminal_mismatch",
    );
}

/** 原 canonical v2 writer 契约；历史文件及显式新封装由 reader 单独判版本。 */
export function assertReplayDocument(value: unknown): asserts value is ReplayDocument {
  if (value !== null && typeof value === "object") assertSerializedData(value, "document");
  assertReplayShape(value);
  if (value.schemaVersion !== REPLAY_SCHEMA_VERSION)
    throw new ReplayDocumentValidationError("unsupported_version", "schemaVersion");
}

/** 只读转换，先判封装和内层版本再解释历史别名；昵称、发言等用户原文不改写。 */
export function readReplayDocument(value: unknown): ReplayDocument {
  if (value !== null && typeof value === "object") assertSerializedData(value, "document");
  value = unwrapRecordingEnvelope(value, "public_replay").payload;
  if (!isRecord(value)) throw new ReplayDocumentValidationError("invalid_document", "document");
  const version = value.schemaVersion;
  if (version !== undefined && version !== 1 && version !== REPLAY_SCHEMA_VERSION)
    throw new ReplayDocumentValidationError("unsupported_version", "schemaVersion");
  assertReplayShape(value);
  if (version === REPLAY_SCHEMA_VERSION) {
    const result = structuredClone(value);
    assertReplayDocument(result);
    return result as ReplayDocument;
  }
  const result = structuredClone(value) as ReplayDocument;
  result.schemaVersion = REPLAY_SCHEMA_VERSION;
  result.players = result.players.map((player) => ({
    ...player,
    role: legacyRoleId(player.role),
    camp: legacyCampId(player.camp),
  }));
  result.result.winner = result.result.winner === null ? null : legacyCampId(result.result.winner);
  result.result.reason =
    result.result.reason === null ? null : legacyResultReasonId(result.result.reason);
  result.events = result.events.map((event) => {
    const payload = { ...event.payload };
    if (event.type === "phase_changed" && typeof payload.phase === "string")
      payload.phase = legacyPhaseId(payload.phase);
    if (event.type === "game_over" || event.type === "phase_changed") {
      if (typeof payload.winner === "string") payload.winner = legacyCampId(payload.winner);
      if (typeof payload.reason === "string") payload.reason = legacyResultReasonId(payload.reason);
    }
    if (event.type === "god_private_game_info" && Array.isArray(payload.players))
      payload.players = payload.players.map((player) =>
        isRecord(player)
          ? {
              ...player,
              ...(typeof player.role === "string" ? { role: legacyRoleId(player.role) } : {}),
              ...(typeof player.camp === "string" ? { camp: legacyCampId(player.camp) } : {}),
            }
          : player,
      );
    return {
      ...event,
      phase: legacyPhaseId(event.phase),
      ...(event.stage === undefined ? {} : { stage: legacyStageId(event.stage) }),
      payload,
    };
  });
  assertReplayDocument(result);
  return result;
}

export * from "./player_record";

export * from "./error_diagnostic";

export * from "./archive-envelope";

/** 前端 canonical 入口保留声明供真实展示支持检查；旧裸档返回 null，不猜造历史身份。 */
export function readReplayArchive(value: unknown): { replay: ReplayDocument; identities: RecordingIdentities | null } {
  if (value !== null && typeof value === "object") assertSerializedData(value, "document");
  const archive = unwrapRecordingEnvelope(value, "public_replay");
  return { replay: readReplayDocument(archive.payload), identities: archive.identities };
}

export * from "./manifest";
