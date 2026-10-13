/**
 * 负责当前录制 envelope 的语义声明与已捕获构建来源；输入为原归档或严格 Trace 的元数据。
 * 输出为独立 public／strict 封装及明确身份核对；真实 engine／RNG 只复制实际 metadata，不推测或伪造来源。
 * 未建立 Trace 的公开初始档把 build／ruleset 标为 null。规则执行、资源付款和精确当前构建校验仍归执行器。
 * 同名文件的 envelope 是显式格式迁移，内层 schema 2、历史 sourceHash 和原文保持，不增加持久化文件。
 */
import { ACTION_REQUEST_CONTRACT } from "@ai-werewolf-arena/game-contract";
import { GAME_PRESENTATION_CONTRACT } from "@ai-werewolf-arena/game-presentation";
import {
  createRecordingEnvelope,
  type RecordingIdentities,
  type ReplayDocument,
} from "@ai-werewolf-arena/replay-contract";
import type { ReproductionMetadata, ReproductionRecord } from "./reproduction";

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
export function createReproductionArchive(record: ReproductionRecord) {
  return createRecordingEnvelope(
    "strict_reproduction",
    record,
    currentRecordingIdentities(record.metadata),
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
