/**
 * 文件集成测试负责 manifest 与玩家文件的真实初始／增量／终结版本和同Trace捕获来源。
 * 输入为临时会话、字面玩家事件、初始化World及私有seed；预期为原文件集合／字段、声明与种子隔离。
 * 不推进对局、运行模型或重写golden，身份更新不触发额外dirty／IO；审计仍消费原内存视图。
 */
import { expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createRandom } from "../../../src/core/domain/random";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import {
  beginGameReproduction,
  currentEngineVersion,
  captureCheckpoint,
} from "../../../src/runtime/simulation/reproduction_context";
import { readReplayManifest, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

test("actual manifest and player publications use truthful source declarations without leaking the private seed", async () => {
  const root = await createTestTempDirectory("awa-manifest-player-identity-");
  const random = createRandom("private_seed_stays_manifest_and_tape");
  const manager = await SessionRecordManager.create(
    {
      sessionId: "identity",
      board: "six_player_mvp",
      startedAtIso: "2026-10-13T00:00:00.000Z",
      random: random.metadata,
    },
    root,
  );
  const context = bootstrapGame(sixPlayerMvpConfig, { random });
  const checkpoint = captureCheckpoint(
    context.world,
    context.phaseManager.getSnapshot(),
    0,
    true,
    context.phaseManager.getEvents().length,
  );
  const meta = {
    endedAtIso: "2026-10-13T00:00:01.000Z",
    winner: null,
    finishReason: "runtime_timeout",
    players: checkpoint.players.map(({ id, role, camp, alive, name }) => ({
      player_id: id,
      role,
      camp,
      alive,
      name,
    })),
  };
  try {
    const first = readReplayManifest(
      JSON.parse(await readFile(path.join(manager.sessionDir, "manifest.json"), "utf8")),
    );
    expect(first.schemaVersion).toBe(1);
    expect(first.identities!.build).toBeNull();
    expect(first.random!.seed).toBe("private_seed_stays_manifest_and_tape");
    manager.recordPlayerEvent({
      playerId: 1,
      role: "wolf",
      camp: "wolf",
      day: 1,
      phase: "night",
      stage: "wolf_vote",
      requestId: "literal_event",
      event: { seq: 1, type: "literal_unknown", payload: { text: "原文 / User original" } },
    });
    await manager.flushNow();
    const initialPlayer = JSON.parse(
      await readFile(path.join(manager.sessionDir, "players/player_1.json"), "utf8"),
    );
    expect(initialPlayer.kind).toBe("player_view");
    expect(initialPlayer.payload.schemaVersion).toBe(2);
    expect(initialPlayer.identities.build).toBeNull();
    const engine = await currentEngineVersion();
    beginGameReproduction(manager, context, {
      engine,
      boardId: "six_player_mvp",
      locale: "zh-CN",
      maxDays: 1,
    });
    await manager.flushNow();
    const afterTraceOnly = JSON.parse(
      await readFile(path.join(manager.sessionDir, "manifest.json"), "utf8"),
    );
    expect(afterTraceOnly.identities.build).toBeNull(); // 来源本身不改变原dirty；没有新玩家/public事件时不额外发布清单。
    manager.recordPlayerEvent({
      playerId: 1,
      role: "wolf",
      camp: "wolf",
      day: 1,
      phase: "night",
      stage: "wolf_vote",
      requestId: "literal_event_2",
      event: { seq: 2, type: "literal_unknown", payload: { text: "第二条原文" } },
    });
    await manager.flushNow();
    const current = readReplayManifest(
      JSON.parse(await readFile(path.join(manager.sessionDir, "manifest.json"), "utf8")),
    );
    expect(current.identities!.build!.engine).toEqual(engine);
    const rawPlayer = await readFile(
      path.join(manager.sessionDir, "players/player_1.json"),
      "utf8",
    );
    expect(rawPlayer).not.toContain("private_seed_stays_manifest_and_tape");
    const view = readReplayPlayerView(JSON.parse(rawPlayer));
    expect(
      view.timeline
        .filter((x) => x.kind === "event")
        .map((x) => (x.kind === "event" ? x.event.seq : null)),
    ).toEqual([1, 2]);
    expect(view.timeline[0]!.kind === "event" && view.timeline[0]!.event.payload.text).toBe(
      "原文 / User original",
    );
    const summary = await manager.finalize(meta);
    expect(summary.manifest.identities).toBeUndefined();
    expect(summary.playerViews[0]!.schemaVersion).toBe(2);
    const final = readReplayManifest(
      JSON.parse(await readFile(path.join(manager.sessionDir, "manifest.json"), "utf8")),
    );
    expect(final.identities!.build!.engine).toEqual(engine);
    expect(final.players).toEqual(meta.players);
    expect((await readdir(manager.sessionDir)).sort()).toEqual([
      "debug_reports.json",
      "logic_ops.json",
      "manifest.json",
      "phase_windows.json",
      "players",
      "replay.json",
      "reproduction.json",
      "timeline_index.json",
    ]);
  } finally {
    await manager.finalize(meta);
  }
});
