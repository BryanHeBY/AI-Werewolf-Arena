/**
 * 负责四类录制文件的语义身份与已捕获构建来源；输入为原归档或严格 Trace 的元数据。
 * 输出为 public／strict／player 封装、manifest 内联声明及明确身份核对；协议常量直接从中立 contract 读取，
 * 不加载 renderer／文案聚合。
 * 真实 engine／RNG 只复制实际 metadata，不推测或伪造来源。
 * 未建立 Trace 的公开初始档把 build／ruleset 标为 null。规则执行、资源付款和精确当前构建校验仍归执行器。
 * 同名文件的身份声明是显式格式迁移；公开／玩家内层仍为 2，严格 Tape 按自身数据版本声明 2／3，manifest 为内联 1。
 * 历史 sourceHash 和用户原文保持，不增加持久化文件。
 */
import {
  ACTION_REQUEST_CONTRACT,
  GAME_PRESENTATION_CONTRACT,
} from "@ai-werewolf-arena/game-contract";
import {
  createRecordingEnvelope,
  type RecordingIdentities,
  type ReplayDocument,
  type CanonicalReplayPlayerView,
  createReplayManifest,
} from "@ai-werewolf-arena/replay-contract";
import type { ReplayManifest } from "./contracts";
import type { ReproductionMetadata, ReproductionRecord } from "./reproduction/format";

export function currentRecordingIdentities(
  metadata?: Pick<ReproductionMetadata, "engine" | "random" | "ruleset">,
): RecordingIdentities {
  return structuredClone({
    request: ACTION_REQUEST_CONTRACT,
    presentation: GAME_PRESENTATION_CONTRACT,
    ruleset: metadata?.ruleset ?? null,
    // seed 继续仅在私有 manifest／Tape；公开身份只声明 RNG 算法、流策略和实际路径。
    build: metadata
      ? {
          engine: metadata.engine,
          random: {
            algorithm: metadata.random.algorithm,
            streamPolicy: metadata.random.streamPolicy,
            path: metadata.random.path,
          },
        }
      : null,
  });
}
export function createPublicReplayArchive(
  document: ReplayDocument,
  identities: RecordingIdentities,
) {
  return createRecordingEnvelope("public_replay", document, identities);
}
/** 严格版本只从自身 data descriptor 选择；完整结构与真正构建身份仍由各自 reader／执行器核对。 */
export function createReproductionArchive(record: ReproductionRecord) {
  // 原 metadata 身份准备先完成；新增 descriptor 反射可能触发 Proxy trap，不宣称任意反射顺序等价。
  // 访问器不执行，缺席／非 3 仍声明 2，交统一纯数据与版本检查拒绝坏 payload，不补造或改写版本。
  const identities = currentRecordingIdentities(record.metadata);
  const schemaVersion = Object.getOwnPropertyDescriptor(record, "schemaVersion");
  return createRecordingEnvelope(
    "strict_reproduction",
    record,
    identities,
    schemaVersion && "value" in schemaVersion && schemaVersion.value === 3 ? 3 : 2,
  );
}
/**
 * 执行器在原 source／lock、RNG 与 ruleset 校验之后调用；历史裸 Tape 不补造声明。
 * 新声明只能与本版本和 payload 中原来源一致，不能绕过精确指纹或授权跨构建执行。
 */
export function reproductionIdentitiesMatch(
  identities: RecordingIdentities | null,
  record: ReproductionRecord,
): boolean {
  if (identities === null) return true;
  const { request, presentation, ruleset, build } = identities;
  const { engine, random } = record.metadata;
  return (
    request.id === ACTION_REQUEST_CONTRACT.id &&
    request.version === ACTION_REQUEST_CONTRACT.version &&
    presentation.id === GAME_PRESENTATION_CONTRACT.id &&
    presentation.version === GAME_PRESENTATION_CONTRACT.version &&
    ruleset?.id === record.metadata.ruleset.id &&
    ruleset.version === record.metadata.ruleset.version &&
    build !== null &&
    build.engine.id === engine.id &&
    build.engine.sourceHash === engine.sourceHash &&
    build.engine.lockHash === engine.lockHash &&
    build.engine.commit === engine.commit &&
    build.random.algorithm === random.algorithm &&
    build.random.streamPolicy === random.streamPolicy &&
    build.random.path.length === random.path.length &&
    build.random.path.every((name, i) => name === random.path[i])
  );
}

/** 原 root 数据与私有 seed 保留；只在真实清单写入处附上本会话当前捕获声明。 */
export function createManifestArchive(manifest: ReplayManifest, identities: RecordingIdentities) {
  return createReplayManifest(manifest, identities);
}
/** 玩家文件仍以原 inner2 保存所有局部序号／原文，header 不包含私有 seed。 */
export function createPlayerViewArchive(
  view: CanonicalReplayPlayerView,
  identities: RecordingIdentities,
) {
  return createRecordingEnvelope("player_view", view, identities);
}
