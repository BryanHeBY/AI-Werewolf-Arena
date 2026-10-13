/**
 * 负责玩家私有时间线的原 schema 2 验证、历史别名转换和新 player envelope 准入。
 * 输入为旧无声明／v1／v2 或显式新封装；输出保留原 prompt、工具、模型原文及 player 局部序号。
 * 新声明必须符合当前请求／展示数据协议；不把纯声明当真实来源签名或行动许可，不导入 renderer。
 */
import { unwrapRecordingEnvelope, assertCurrentRecordingContracts } from "./archive-envelope";
import { assertErrorDiagnostic, type ErrorDiagnostic } from "./error_diagnostic";
import { assertField, isRecord, ReplayDocumentValidationError } from "./validation";
import { isLocale, type Locale } from "@ai-werewolf-arena/game-catalog";
import { legacyPhaseId, legacyStageId, legacyRoleId, legacyCampId } from "./legacy_aliases";

/** 玩家单回合增量消息。 */
export interface ReplayPlayerDeltaMessage {
  role: "system" | "user" | "assistant" | "tool" | "meta";
  kind:
    | "prompt"
    | "retry_prompt"
    | "assistant_output"
    | "request_error"
    | "constraint_warning"
    | "tool_call"
    | "tool_result"
    | "action_summary"
    | "fallback";
  attempt?: number;
  diagnostic?: ErrorDiagnostic;
  content?: string;
  name?: string;
  args?: Record<string, unknown>;
  accepted?: boolean;
  result?: Record<string, unknown> | string;
}

/** 玩家视角下的结构化事件时间线条目。 */
export interface ReplayPlayerEventEntry {
  seq: number;
  kind: "event";
  day: number;
  phase: string;
  stage: string;
  request_id: string;
  timestamp?: string;
  /** 仅供复盘与审计关联领域事件；不会进入玩家 Agent 协议。 */
  source_event_seq?: number;
  event: { seq: number; type: string; payload: Record<string, unknown> };
}

/** 玩家回合时间线条目。 */
export interface ReplayPlayerTurnEntry {
  seq: number;
  kind: "turn";
  day: number;
  phase: string;
  stage: string;
  request_id: string;
  timestamp?: string;
  turn_seq: number;
  delta_messages: ReplayPlayerDeltaMessage[];
}

/** 玩家时间线条目联合类型。 */
export type ReplayPlayerTimelineEntry = ReplayPlayerEventEntry | ReplayPlayerTurnEntry;

/** 玩家视角复盘结构。 */
export interface ReplayPlayerView {
  schemaVersion?: 2;
  locale?: Locale;
  player_id: number;
  role: string;
  camp: string;
  initial_prompt?: {
    day: number;
    phase: string;
    stage: string;
    request_id: string;
    timestamp?: string;
    prompt_system?: string;
    board_info?: string;
    prompt_user?: string[];
  };
  timeline: ReplayPlayerTimelineEntry[];
}

export type CanonicalReplayPlayerView = ReplayPlayerView & { schemaVersion: 2 };

/** 校验原内层 wire 字段，不改写模型或玩家原文；缺席身份不被补造成当前来源。 */
function assertPlayerShape(value: unknown): asserts value is ReplayPlayerView {
  assertField(isRecord(value), "player.document");
  assertField(
    typeof value.player_id === "number" &&
      Number.isSafeInteger(value.player_id) &&
      value.player_id > 0,
    "player.player_id",
  );
  assertField(typeof value.role === "string", "player.role");
  assertField(typeof value.camp === "string", "player.camp");
  assertField(value.locale === undefined || isLocale(value.locale), "player.locale");
  assertField(Array.isArray(value.timeline), "player.timeline");
  const metadata = (entry: Record<string, unknown>, path: string) => {
    assertField(typeof entry.day === "number" && Number.isSafeInteger(entry.day), `${path}.day`);
    assertField(typeof entry.phase === "string", `${path}.phase`);
    assertField(typeof entry.stage === "string", `${path}.stage`);
    assertField(typeof entry.request_id === "string", `${path}.request_id`);
    assertField(
      entry.timestamp === undefined || typeof entry.timestamp === "string",
      `${path}.timestamp`,
    );
  };
  if (value.initial_prompt !== undefined) {
    assertField(isRecord(value.initial_prompt), "player.initial_prompt");
    metadata(value.initial_prompt, "player.initial_prompt");
    for (const field of ["prompt_system", "board_info"])
      assertField(
        value.initial_prompt[field] === undefined ||
          typeof value.initial_prompt[field] === "string",
        `player.initial_prompt.${field}`,
      );
    assertField(
      value.initial_prompt.prompt_user === undefined ||
        (Array.isArray(value.initial_prompt.prompt_user) &&
          value.initial_prompt.prompt_user.every((item) => typeof item === "string")),
      "player.initial_prompt.prompt_user",
    );
  }
  for (let index = 0; index < value.timeline.length; index++) {
    const entry: unknown = value.timeline[index];
    const path = `player.timeline[${index}]`;
    assertField(isRecord(entry), path);
    metadata(entry, path);
    assertField(entry.seq === index + 1, `${path}.seq`);
    if (entry.kind === "event") {
      assertField(isRecord(entry.event), `${path}.event`);
      assertField(
        typeof entry.event.seq === "number" &&
          Number.isSafeInteger(entry.event.seq) &&
          entry.event.seq > 0,
        `${path}.event.seq`,
      );
      assertField(
        typeof entry.event.type === "string" && isRecord(entry.event.payload),
        `${path}.event.type/payload`,
      );
      assertField(
        entry.source_event_seq === undefined ||
          (typeof entry.source_event_seq === "number" &&
            Number.isSafeInteger(entry.source_event_seq) &&
            entry.source_event_seq > 0),
        `${path}.source_event_seq`,
      );
    } else {
      assertField(entry.kind === "turn", `${path}.kind`);
      assertField(
        typeof entry.turn_seq === "number" &&
          Number.isSafeInteger(entry.turn_seq) &&
          entry.turn_seq > 0,
        `${path}.turn_seq`,
      );
      assertField(Array.isArray(entry.delta_messages), `${path}.delta_messages`);
      for (const [messageIndex, message] of entry.delta_messages.entries()) {
        const messagePath = `${path}.delta_messages[${messageIndex}]`;
        assertField(isRecord(message), messagePath);
        assertField(
          typeof message.role === "string" &&
            ["system", "user", "assistant", "tool", "meta"].includes(message.role),
          `${messagePath}.role`,
        );
        assertField(
          typeof message.kind === "string" &&
            [
              "prompt",
              "retry_prompt",
              "assistant_output",
              "request_error",
              "constraint_warning",
              "tool_call",
              "tool_result",
              "action_summary",
              "fallback",
            ].includes(message.kind),
          `${messagePath}.kind`,
        );
        for (const field of ["content", "name"])
          assertField(
            message[field] === undefined || typeof message[field] === "string",
            `${messagePath}.${field}`,
          );
        if (message.diagnostic !== undefined)
          assertErrorDiagnostic(message.diagnostic, `${messagePath}.diagnostic`);
        assertField(
          message.attempt === undefined ||
            (typeof message.attempt === "number" &&
              Number.isSafeInteger(message.attempt) &&
              message.attempt >= 0),
          `${messagePath}.attempt`,
        );
        assertField(message.args === undefined || isRecord(message.args), `${messagePath}.args`);
        assertField(
          message.accepted === undefined || typeof message.accepted === "boolean",
          `${messagePath}.accepted`,
        );
        assertField(
          message.result === undefined ||
            typeof message.result === "string" ||
            isRecord(message.result),
          `${messagePath}.result`,
        );
      }
    }
  }
}

export function assertReplayPlayerView(value: unknown): asserts value is CanonicalReplayPlayerView {
  assertPlayerShape(value);
  if (value.schemaVersion !== 2)
    throw new ReplayDocumentValidationError("unsupported_version", "player.schemaVersion");
}

export function readReplayPlayerView(value: unknown): CanonicalReplayPlayerView {
  const archive = unwrapRecordingEnvelope(value, "player_view");
  if (archive.identities) assertCurrentRecordingContracts(archive.identities);
  value = archive.payload;
  if (!isRecord(value))
    throw new ReplayDocumentValidationError("invalid_document", "player.document");
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1 && value.schemaVersion !== 2)
    throw new ReplayDocumentValidationError("unsupported_version", "player.schemaVersion");
  const snapshot = structuredClone(value);
  if (
    snapshot.schemaVersion !== undefined &&
    snapshot.schemaVersion !== 1 &&
    snapshot.schemaVersion !== 2
  )
    throw new ReplayDocumentValidationError("unsupported_version", "player.schemaVersion");
  const alreadyCurrent = snapshot.schemaVersion === 2;
  assertPlayerShape(snapshot);
  const result = snapshot as CanonicalReplayPlayerView;
  result.schemaVersion = 2;
  if (alreadyCurrent) return result;
  result.role = legacyRoleId(result.role);
  result.camp = legacyCampId(result.camp);
  const normalize = <T extends { phase: string; stage: string }>(entry: T): T => ({
    ...entry,
    phase: legacyPhaseId(entry.phase),
    stage: legacyStageId(entry.stage),
  });
  if (result.initial_prompt) result.initial_prompt = normalize(result.initial_prompt);
  result.timeline = result.timeline.map((entry) => normalize(entry));
  return result;
}
