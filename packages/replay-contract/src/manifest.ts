/**
 * 负责会话私有 manifest 的字段结构、显式版本及身份声明读取；输入为原裸档或新内联 schema 1。
 * 输出保留全部原字段、私有种子和用户原文；本纯数据契约是该文件形状的唯一所有者。
 * 不读文件、不安装角色、不使用 seed 推导对局或授权跨构建；未知声明版本明确拒绝，旧无声明档不补造身份。
 */
import { isLocale, type Locale, type SealedVictoryResult } from "@ai-werewolf-arena/game-catalog";
import {
  assertField,
  assertSerializedData,
  isRecord,
  ReplayDocumentValidationError,
} from "./validation";
import {
  readRecordingIdentities,
  assertCurrentRecordingContracts,
  type RecordingIdentities,
} from "./archive-envelope";
import { readVictoryResult } from "./outcomes";

export const MANIFEST_SCHEMA_VERSION = 1 as const;
export interface ReplayManifestPlayerData {
  player_id: number;
  role: string;
  camp: string;
  alive: boolean;
  name?: string;
}
/** seed 仅属于私有会话清单／严格 Tape；公开或 player envelope 的 build 不包含该字段。 */
export interface ReplayManifestData {
  schemaVersion?: typeof MANIFEST_SCHEMA_VERSION;
  identities?: RecordingIdentities;
  locale?: Locale;
  session_id: string;
  board: string;
  started_at: string;
  ended_at: string;
  winner: string | null;
  finish_reason: string;
  game_result?: SealedVictoryResult;
  players: ReplayManifestPlayerData[];
  random?: { seed: string; algorithm: string; streamPolicy: string; path: readonly string[] };
  files: {
    replay: string;
    reproduction?: string;
    phase_windows?: string;
    timeline_index?: string;
    logic_ops: string;
    debug_reports: string;
    debug_summary: string;
    player_views: string[];
  };
}
function assertManifestShape(value: unknown): asserts value is ReplayManifestData {
  assertField(isRecord(value), "manifest");
  for (const key of ["session_id", "board", "started_at", "ended_at", "finish_reason"])
    assertField(typeof value[key] === "string", `manifest.${key}`);
  assertField(value.locale === undefined || isLocale(value.locale), "manifest.locale");
  assertField(value.winner === null || typeof value.winner === "string", "manifest.winner");
  assertField(Array.isArray(value.players), "manifest.players");
  for (const p of value.players) {
    assertField(
      isRecord(p) &&
        Number.isSafeInteger(p.player_id) &&
        Number(p.player_id) > 0 &&
        typeof p.role === "string" &&
        typeof p.camp === "string" &&
        typeof p.alive === "boolean" &&
        (p.name === undefined || typeof p.name === "string"),
      "manifest.players",
    );
  }
  assertField(isRecord(value.files), "manifest.files");
  for (const key of ["replay", "logic_ops", "debug_reports", "debug_summary"])
    assertField(typeof value.files[key] === "string", `manifest.files.${key}`);
  for (const key of ["reproduction", "phase_windows", "timeline_index"])
    assertField(
      value.files[key] === undefined || typeof value.files[key] === "string",
      `manifest.files.${key}`,
    );
  assertField(
    Array.isArray(value.files.player_views) &&
      value.files.player_views.every((p) => typeof p === "string"),
    "manifest.files.player_views",
  );
  if (value.random !== undefined) {
    assertField(
      isRecord(value.random) &&
        typeof value.random.seed === "string" &&
        typeof value.random.algorithm === "string" &&
        typeof value.random.streamPolicy === "string" &&
        Array.isArray(value.random.path) &&
        value.random.path.every((p) => typeof p === "string"),
      "manifest.random",
    );
  }
  if (value.game_result !== undefined) {
    const decision = readVictoryResult(
      value.game_result,
      value.players.map((p) => p.player_id as number),
    );
    assertField(decision.winner === value.winner, "manifest.game_result.winner");
  }
}
/** 原无版本清单保持字段／缺席身份；schema 1 必须携带当前声明，但声明不能替代 source 检查。 */
export function readReplayManifest(value: unknown): ReplayManifestData {
  if (value !== null && typeof value === "object") assertSerializedData(value, "manifest");
  assertField(isRecord(value), "manifest");
  if (value.schemaVersion !== undefined && value.schemaVersion !== MANIFEST_SCHEMA_VERSION)
    throw new ReplayDocumentValidationError("unsupported_version", "manifest.schemaVersion");
  if (value.schemaVersion === MANIFEST_SCHEMA_VERSION)
    assertCurrentRecordingContracts(readRecordingIdentities(value.identities));
  assertManifestShape(value);
  return structuredClone(value);
}
/** 只给本次真实写入追加内联声明；既有清单数据与 RNG seed 不搬到其他文件。 */
export function createReplayManifest<T extends ReplayManifestData>(
  value: T,
  identities: RecordingIdentities,
): T & { schemaVersion: 1; identities: RecordingIdentities } {
  const result = { ...value, schemaVersion: MANIFEST_SCHEMA_VERSION, identities };
  readReplayManifest(result);
  return structuredClone(result);
}
