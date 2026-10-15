/**
 * 为前端复盘测试选择 God、checkpoint 和玩家归档。输入为稳定 suite 身份及显式玩家 id/role/camp 筛选；
 * 输出为清单现行路径和已序列化玩家资料，同 cohort 只取一份 God、至多一份 checkpoint 及玩家视角成员。
 * 本支持层不读归档字节、不生成可见性／规则／验收预期，实际加载和读取错误仍归调用方。
 */
import snapshot from "../../../../tooling/refactor/fixtures/manifest.json";
import {
  fixtureSuiteById,
  parseFixtureManifest,
  type FixtureActor,
  type FixtureArtifact,
  type FixtureSuite,
} from "../../../../tooling/refactor/fixture-manifest";

const manifest = parseFixtureManifest(JSON.stringify(snapshot));
const artifacts = new Map(manifest.files.map((file) => [file.originPath, file]));
export interface ReplayFixtureFiles {
  suite: FixtureSuite;
  godReplay: FixtureArtifact;
  checkpoint: FixtureArtifact | undefined;
  playerViews: readonly FixtureArtifact[];
}

export function replayFixtureFiles(suiteId: string): ReplayFixtureFiles {
  const suite = fixtureSuiteById(manifest, suiteId);
  if (suite.owner !== "frontend" || suite.kind !== "recorded-archive")
    throw new Error("frontend_fixture_requires_recorded_archive");
  const members = suite.files.map((origin) => {
    const file = artifacts.get(origin);
    if (!file || file.owner !== "frontend")
      throw new Error("frontend_fixture_member_owner_invalid");
    return file;
  });
  const gods = members.filter((file) => file.kind === "god-replay");
  const checkpoints = members.filter((file) => file.kind === "checkpoint");
  if (gods.length !== 1 || checkpoints.length > 1)
    throw new Error("frontend_fixture_archive_cardinality_invalid");
  const playerViews = members.filter((file) =>
    ["player-view", "player-view-bundle"].includes(file.kind),
  );
  if (gods.length + checkpoints.length + playerViews.length !== members.length)
    throw new Error("frontend_fixture_member_kind_invalid");
  return { suite, godReplay: gods[0]!, checkpoint: checkpoints[0], playerViews };
}

export function playerFixtureFiles(
  suiteId: string,
  actor: Partial<FixtureActor>,
): readonly FixtureArtifact[] {
  if (
    !Object.keys(actor).length ||
    Object.keys(actor).some((key) => !["playerId", "role", "camp"].includes(key))
  )
    throw new Error("frontend_fixture_actor_filter_required");
  if (
    (actor.playerId !== undefined &&
      (!Number.isSafeInteger(actor.playerId) || actor.playerId <= 0)) ||
    (actor.role !== undefined && !actor.role.trim()) ||
    (actor.camp !== undefined && !actor.camp.trim())
  )
    throw new Error("frontend_fixture_actor_filter_invalid");
  const files = replayFixtureFiles(suiteId).playerViews.filter(
    (file) =>
      file.metadata.actors.state === "observed" &&
      file.metadata.actors.value.some(
        (candidate) =>
          (actor.playerId === undefined || candidate.playerId === actor.playerId) &&
          (actor.role === undefined || candidate.role === actor.role) &&
          (actor.camp === undefined || candidate.camp === actor.camp),
      ),
  );
  if (!files.length) throw new Error("frontend_fixture_actor_missing");
  return files;
}

/** 只解析已登记的前端归档身份；实际读取及原错误仍由调用方处理。 */
export function frontendFixtureURL(originPath: string): URL {
  const file = artifacts.get(originPath);
  if (!file || file.owner !== "frontend" || file.kind === "adapter-script")
    throw new Error("frontend_fixture_origin_missing");
  return new URL("../../../../" + file.currentPath, import.meta.url);
}
export function frontendFixtureArtifacts(
  kind: "god-replay" | "player-view" | "player-view-bundle" | "checkpoint",
): readonly FixtureArtifact[] {
  return manifest.files.filter((file) => file.owner === "frontend" && file.kind === kind);
}
