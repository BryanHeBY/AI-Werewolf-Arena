/**
 * 负责显式录制封装的真实文件 writer／export／strict reader／CLI 兼容集成测试。
 * 输入为临时会话、初始化 World、零周期原生 Tape 和字面版本／来源变体；输出由声明、原文、错误顺序与来源身份核对。
 * 来源取实际 currentEngineVersion，不伪造来源适配当前构建；只零周期重放，不运行完整对局、模型或历史 golden。
 */
import { expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createRandom } from "../../../src/core/domain/random";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { createReproductionArchive } from "../../../src/recording/archive_identity";
import { ReproductionTrace } from "../../../src/recording/reproduction-trace";
import { currentRecordingIdentities } from "../../../src/recording/archive_identity";
import { parseReproductionRecord } from "../../../src/recording/reproduction";
import {
  beginGameReproduction,
  currentEngineVersion,
  captureCheckpoint,
} from "../../../src/runtime/simulation/reproduction_context";
import {
  readReproductionArchive,
  replayReproduction,
} from "../../../src/runtime/simulation/replay_reproduction";
import { main as replayCli } from "../../../src/runtime/cli/replay_actions";
import { exportReplayBundle } from "../../../src/replay/export_replay_bundle";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { GameEventRecorder } from "../../../src/runtime/game_event_recorder";
import { Phase } from "@ai-werewolf-arena/game-contract";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";
async function fixture() {
  const root = await createTestTempDirectory("awa-explicit-identities-");
  const context = bootstrapGame(sixPlayerMvpConfig, {
    random: createRandom("literal_private_archive_seed"),
  });
  const manager = await SessionRecordManager.create(
    { sessionId: "identity", board: "six_player_mvp", startedAtIso: "2026-10-13T00:00:00.000Z" },
    root,
  );
  const engine = await currentEngineVersion();
  const trace = beginGameReproduction(manager, context, {
    engine,
    boardId: "six_player_mvp",
    locale: "zh-CN",
    maxDays: 1,
  });
  const meta = {
    endedAtIso: "2026-10-13T00:00:01.000Z",
    winner: null,
    finishReason: "runtime_timeout",
    players: captureCheckpoint(
      context.world,
      context.phaseManager.getSnapshot(),
      0,
      true,
      context.phaseManager.getEvents().length,
    ).players.map(({ id, role, camp, alive, name }) => ({
      player_id: id,
      role,
      camp,
      alive,
      name,
    })),
  };
  const record = trace.build({
    operations: [],
    termination: { reason: "runtime_timeout", winner: null },
  });
  return { root, context, manager, trace, record, engine, meta };
}
test("actual initial prefix final and export write envelope identities without exposing private seed", async () => {
  const f = await fixture();
  try {
    const first = JSON.parse(
      await readFile(path.join(f.manager.sessionDir, "replay.json"), "utf8"),
    );
    expect(first.format).toBe("awa-recording");
    expect(first.envelopeVersion).toBe(1);
    expect(first.identities.build).toBeNull();
    new GameEventRecorder({ world: f.context.world, replayManager: f.manager }, Phase.Night).flush(
      f.context.phaseManager.getEvents(),
    );
    await f.manager.flushNow();
    const prefix = JSON.parse(
      await readFile(path.join(f.manager.sessionDir, "reproduction.json"), "utf8"),
    );
    expect(prefix.payload.schemaVersion).toBe(2);
    expect(prefix.payload.finalized).toBe(false);
    expect(prefix.identities.build.engine).toEqual(f.engine);
    await f.manager.finalize(f.meta);
    const final = JSON.parse(
      await readFile(path.join(f.manager.sessionDir, "reproduction.json"), "utf8"),
    );
    expect(final.kind).toBe("strict_reproduction");
    expect(parseReproductionRecord(final).finalized).toBe(true);
    const rawPublic = await readFile(path.join(f.manager.sessionDir, "replay.json"), "utf8");
    expect(rawPublic).not.toContain("literal_private_archive_seed");
    const output = path.join(f.root, "exported.json");
    const canonical = await exportReplayBundle({
      recordRoot: f.root,
      sessionId: "identity",
      outputFile: output,
    });
    const exported = JSON.parse(await readFile(output, "utf8"));
    expect(exported.identities).toEqual(JSON.parse(rawPublic).identities);
    expect(readReplayDocument(exported)).toEqual(canonical);
    expect(final.payload.metadata.random.seed).toBe("literal_private_archive_seed");
  } finally {
    await f.manager.finalize(f.meta);
  }
});
test("current explicit strict envelope performs real zero-cycle reproduction", async () => {
  const f = await fixture();
  try {
    const result = await replayReproduction(
      createReproductionArchive(f.record),
      path.join(f.root, "replayed"),
    );
    expect(result.decisionCount).toBe(0);
    expect(result.snapshot).toEqual(f.context.phaseManager.getSnapshot());
  } finally {
    await f.manager.finalize(f.meta);
  }
});
for (const [field, expected] of [
  ["source", "reproduction_engine_or_lock_incompatible"],
  ["lock", "reproduction_engine_or_lock_incompatible"],
  ["rng", "reproduction_rng_incompatible"],
  ["ruleset", "reproduction_ruleset_incompatible"],
] as const)
  test(`${field} refusal still precedes unknown request declaration`, async () => {
    const f = await fixture();
    try {
      const archive = createReproductionArchive(f.record);
      archive.identities.request.version = "future";
      if (field === "source") archive.payload.metadata.engine.sourceHash = "0".repeat(64);
      if (field === "lock") archive.payload.metadata.engine.lockHash = "0".repeat(64);
      if (field === "rng")
        (archive.payload.metadata.random as { algorithm: string }).algorithm = "future";
      if (field === "ruleset") archive.payload.metadata.ruleset.version = "future";
      await expect(replayReproduction(archive, path.join(f.root, "refused"))).rejects.toThrow(
        expected,
      );
    } finally {
      await f.manager.finalize(f.meta);
    }
  });
test("file reader and actual CLI preserve unknown declaration rather than stripping it before execution", async () => {
  const f = await fixture();
  try {
    const archive = createReproductionArchive(f.record);
    archive.identities.request.version = "future";
    const file = path.join(f.root, "future.json");
    await writeFile(file, JSON.stringify(archive));
    const read = await readReproductionArchive(file);
    expect(read.identities!.request.version).toBe("future");
    expect(read.record.metadata.engine).toEqual(f.engine);
    await expect(
      replayCli(["--record", file, "--record-root", path.join(f.root, "refused")], {
        locale: "en",
        explicit: true,
      }),
    ).rejects.toThrow("reproduction_contract_identity_incompatible");
  } finally {
    await f.manager.finalize(f.meta);
  }
});
test("semantic declarations cannot mislabel current payload source or allow old inner Tape version", async () => {
  const f = await fixture();
  try {
    const archive = createReproductionArchive(f.record);
    archive.identities.build!.engine.sourceHash = "0".repeat(64);
    await expect(replayReproduction(archive, path.join(f.root, "refused"))).rejects.toThrow(
      "reproduction_contract_identity_incompatible",
    );
    expect(() => parseReproductionRecord({ ...f.record, schemaVersion: 1 })).toThrow(
      "reproduction_schema_not_supported",
    );
  } finally {
    await f.manager.finalize(f.meta);
  }
});

test("public provenance uses Trace's one captured getter result and remains detached", async () => {
  const f = await fixture();
  try {
    let reads = 0;
    const metadata = {
      ...f.record.metadata,
      get engine() {
        reads++;
        return {
          id: "awa-engine" as const,
          sourceHash: (reads === 1 ? "a" : "c").repeat(64),
          lockHash: "b".repeat(64),
        };
      },
    };
    const trace = new ReproductionTrace(metadata, () => {});
    const captured = trace.recordedMetadataIdentity();
    expect(reads).toBe(1);
    expect(captured.engine.sourceHash).toBe("a".repeat(64));
    captured.engine.sourceHash = "0".repeat(64);
    const identity = currentRecordingIdentities(trace.recordedMetadataIdentity());
    expect(identity.build!.engine.sourceHash).toBe("a".repeat(64));
    expect(Object.hasOwn(identity.build!.random, "seed")).toBe(false);
    expect(reads).toBe(1);
  } finally {
    await f.manager.finalize(f.meta);
  }
});
