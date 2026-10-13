/**
 * 负责显式录制封装的版本、纯数据身份与 payload 边界；输入为未知封装或历史裸档，输出为解包结果。
 * 本契约唯一拥有 envelope v1 结构；内层公开 ReplayDocument 和严格 Tape 各自仍为 schema 2。
 * 不解释游戏规则、执行请求或验证真实构建；声明相同不是签名，执行方仍核对实际 source／lock／RNG。
 * 未声明历史数据保持原输入并标记 identity 缺席，不补造来源、语义版本或展示版本。
 */
import {
  assertField,
  assertSerializedData,
  isRecord,
  ReplayDocumentValidationError,
} from "./validation";

export const RECORDING_ENVELOPE_FORMAT = "awa-recording" as const;
export const RECORDING_ENVELOPE_VERSION = 1 as const;
export type RecordingArchiveKind = "public_replay" | "strict_reproduction";
export interface SemanticIdentity {
  id: string;
  version: string;
}
/** 精确来源仅描述已录制事实；公开初始化档的 null 表示当时尚未建立严格 Trace。 */
export interface RecordedBuildIdentity {
  engine: { id: "awa-engine"; sourceHash: string; lockHash: string; commit?: string };
  random: { algorithm: string; streamPolicy: string; path: readonly string[] };
}
export interface RecordingIdentities {
  request: SemanticIdentity;
  presentation: SemanticIdentity;
  ruleset: SemanticIdentity | null;
  build: RecordedBuildIdentity | null;
}
export interface RecordingEnvelope<T> {
  format: typeof RECORDING_ENVELOPE_FORMAT;
  envelopeVersion: typeof RECORDING_ENVELOPE_VERSION;
  kind: RecordingArchiveKind;
  payloadSchemaVersion: 2;
  identities: RecordingIdentities;
  payload: T;
}
export interface UnwrappedRecording {
  payload: unknown;
  identities: RecordingIdentities | null;
}
function assertIdentity(value: unknown, field: string): asserts value is SemanticIdentity {
  assertField(
    isRecord(value) &&
      typeof value.id === "string" &&
      value.id.length > 0 &&
      typeof value.version === "string" &&
      value.version.length > 0,
    field,
  );
}
function assertBuild(value: unknown): asserts value is RecordedBuildIdentity {
  assertField(
    isRecord(value) && isRecord(value.engine) && isRecord(value.random),
    "identities.build",
  );
  const { engine, random } = value;
  assertField(
    engine.id === "awa-engine" &&
      typeof engine.sourceHash === "string" &&
      /^[a-f0-9]{64}$/.test(engine.sourceHash) &&
      typeof engine.lockHash === "string" &&
      /^[a-f0-9]{64}$/.test(engine.lockHash) &&
      (engine.commit === undefined ||
        (typeof engine.commit === "string" && /^[a-f0-9]{40}$/.test(engine.commit))),
    "identities.build.engine",
  );
  assertField(
    typeof random.algorithm === "string" &&
      random.algorithm.length > 0 &&
      typeof random.streamPolicy === "string" &&
      random.streamPolicy.length > 0 &&
      Array.isArray(random.path) &&
      random.path.every((x) => typeof x === "string"),
    "identities.build.random",
  );
}
/**
 * 新封装先拒绝未知版本和错误 kind；历史裸档的 schema／别名处理仍由原 payload reader 拥有。
 * 新封装执行完整纯数据检查；没有允许调用方跳过检查的参数，结构准入仍不表示可信来源。
 */
export function unwrapRecordingEnvelope(
  value: unknown,
  kind: RecordingArchiveKind,
): UnwrappedRecording {
  if (!isRecord(value)) return { payload: value, identities: null };
  // 旧裸档允许自定义 format 扩展；只有本封装的已知数据标记或显式 envelopeVersion 才声明新协议。
  // descriptor 只辨别已有数据属性，不在完整数据检查前触发 format accessor。
  const format = Object.getOwnPropertyDescriptor(value, "format");
  const declared =
    (format && "value" in format && format.value === RECORDING_ENVELOPE_FORMAT) ||
    Object.hasOwn(value, "envelopeVersion");
  if (!declared) return { payload: value, identities: null };
  assertSerializedData(value, "archive");
  if (
    value.format !== RECORDING_ENVELOPE_FORMAT ||
    value.envelopeVersion !== RECORDING_ENVELOPE_VERSION ||
    value.kind !== kind ||
    value.payloadSchemaVersion !== 2
  )
    throw new ReplayDocumentValidationError("unsupported_version", "archive.version");
  assertField(isRecord(value.identities), "identities");
  const identities = value.identities;
  assertIdentity(identities.request, "identities.request");
  assertIdentity(identities.presentation, "identities.presentation");
  if (identities.ruleset !== null) assertIdentity(identities.ruleset, "identities.ruleset");
  if (identities.build !== null) assertBuild(identities.build);
  assertField(
    isRecord(value.payload) && value.payload.schemaVersion === 2,
    "archive.payload.schemaVersion",
  );
  return {
    payload: value.payload,
    identities: structuredClone(identities) as unknown as RecordingIdentities,
  };
}
/** Writer 使用声明的内层 schema 2，不升级或改写历史 payload；返回独立的封装快照。 */
export function createRecordingEnvelope<T>(
  kind: RecordingArchiveKind,
  payload: T,
  identities: RecordingIdentities,
): RecordingEnvelope<T> {
  const result = {
    format: RECORDING_ENVELOPE_FORMAT,
    envelopeVersion: RECORDING_ENVELOPE_VERSION,
    kind,
    payloadSchemaVersion: 2 as const,
    identities,
    payload,
  };
  unwrapRecordingEnvelope(result, kind);
  return structuredClone(result);
}
