/**
 * 负责文件系统录制集成测试，核对必需终档、pending 决定及慢／失败前缀持久化。
 * 输入为临时会话文件、受控决定与严格写入 spy；输出由精确错误身份及原最终 JSON 状态核对。
 * spy 和磁盘入口解包实际新封装后查看原字段，不改预期、restore／finally 顺序，不执行完整对局。
 */
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { parseReproductionRecord } from "../../../src/recording/reproduction/format";
import { unwrapRecordingEnvelope } from "@ai-werewolf-arena/replay-contract";
import { expect, spyOn, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createRandom, Phase, type ActionRequest } from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { SessionRecordManager } from "../../../src/recording/session/recorder";
import { ReplayFileStore } from "../../../src/adapters/filesystem/session-file-store";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../src/app/simulation/reproduction-context";
import { GameEventRecorder } from "../../../src/app/game-event-recorder";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

async function fixture() {
  const root = await createTestTempDirectory("awa-mandatory-record-");
  const context = bootstrapGame(sixPlayerMvpConfig, { random: createRandom("mandatory") });
  const manager = await SessionRecordManager.create(
    { sessionId: "mandatory", board: "six_player_mvp", startedAtIso: "2026-10-07T00:00:00.000Z" },
    root,
  );
  const trace = beginGameReproduction(manager, context, {
    engine: await currentEngineVersion(),
    boardId: "six_player_mvp",
    ...(void sixPlayerMvpConfig, {}),
    locale: "zh-CN",
    maxDays: 30,
  });
  manager.noteReproductionFailure("controller", new Error("synthetic_controller_stop"));
  new GameEventRecorder({ world: context.world, replayManager: manager }, Phase.Night).flush(
    context.phaseManager.getEvents(),
  );
  const meta = {
    endedAtIso: "2026-10-07T00:00:01.000Z",
    winner: null,
    finishReason: "runtime_error",
    players: captureCheckpoint(
      context.world,
      context.phaseManager.getSnapshot(),
      0,
      true,
      0,
    ).players.map((player) => ({
      player_id: player.id,
      role: player.role,
      camp: player.camp,
      alive: player.alive,
    })),
  };
  return { context, manager, trace, meta, root };
}

test("mandatory manifest, public replay and reproduction failures are all awaited and preserved", async () => {
  const { manager, meta } = await fixture();
  const files = ["manifest.json", "replay.json", "reproduction.json"];
  const errors = files.map((file) => new Error(`${file}_write_failed`));
  const realWrite = ReplayFileStore.prototype.writeJsonStrict;
  const write = spyOn(ReplayFileStore.prototype, "writeJsonStrict").mockImplementation(
    async function (this: ReplayFileStore, file, data) {
      const index = files.indexOf(file);
      if (
        index !== -1 &&
        (file !== "reproduction.json" || (unwrapRecordingEnvelope(data, "strict_reproduction").payload as { finalized?: boolean }).finalized)
      )
        throw errors[index];
      return realWrite.call(this, file, data);
    },
  );
  try {
    let failure: unknown;
    try {
      await manager.finalize(meta);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual(errors);
  } finally {
    write.mockRestore();
  }
});

test("pending decisions cannot produce a finalized recording while the public partial replay is still saved", async () => {
  const { manager, trace, meta, root } = await fixture();
  let resolve!: (value: null) => void;
  const response = new Promise<null>((done) => {
    resolve = done;
  });
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
  };
  const pending = trace.decide(request, { getAction: () => response });
  try {
    await expect(manager.finalize(meta)).rejects.toThrow("reproduction_decisions_pending");
    const replay = readReplayDocument(JSON.parse(await readFile(path.join(root, "mandatory/replay.json"), "utf8")));
    expect(replay.result.reason).toBe("runtime_error");
    const partial = parseReproductionRecord(JSON.parse(
      await readFile(path.join(root, "mandatory/reproduction.json"), "utf8"),
    ));
    expect(partial.finalized).toBe(false);
  } finally {
    resolve(null);
    await pending;
  }
});

test("settling a decision during a slow prefix write cannot schedule a later overwrite of the final record", async () => {
  const { manager, trace, meta, root } = await fixture();
  let resolve!: (value: null) => void;
  const response = new Promise<null>((done) => {
    resolve = done;
  });
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
  };
  const pending = trace.decide(request, { getAction: () => response });
  let resume!: () => void;
  let notify!: () => void;
  const blocked = new Promise<void>((done) => {
    resume = done;
  });
  const started = new Promise<void>((done) => {
    notify = done;
  });
  const realWrite = ReplayFileStore.prototype.writeJsonStrict;
  let paused = false;
  const write = spyOn(ReplayFileStore.prototype, "writeJsonStrict").mockImplementation(
    async function (this: ReplayFileStore, file, data) {
      if (!paused && file === "reproduction.json" && !(unwrapRecordingEnvelope(data, "strict_reproduction").payload as { finalized: boolean }).finalized) {
        paused = true;
        notify();
        await blocked;
      }
      return realWrite.call(this, file, data);
    },
  );
  try {
    const finalization = manager.finalize(meta);
    await started;
    resolve(null);
    await pending;
    resume();
    await finalization;
    const file = path.join(root, "mandatory/reproduction.json");
    expect(parseReproductionRecord(JSON.parse(await readFile(file, "utf8"))).finalized).toBe(true);
    await new Promise((done) => setTimeout(done, 160));
    await manager.flushNow();
    expect(parseReproductionRecord(JSON.parse(await readFile(file, "utf8"))).finalized).toBe(true);
  } finally {
    resolve(null);
    resume();
    await pending;
    write.mockRestore();
  }
});

test("a failed strict prefix write remains visible even when the final publication succeeds", async () => {
  const { manager, meta, root } = await fixture();
  const error = new Error("prefix_write_failed");
  const realWrite = ReplayFileStore.prototype.writeJsonStrict;
  let failed = false;
  const write = spyOn(ReplayFileStore.prototype, "writeJsonStrict").mockImplementation(
    async function (this: ReplayFileStore, file, data) {
      if (!failed && file === "reproduction.json" && !(unwrapRecordingEnvelope(data, "strict_reproduction").payload as { finalized: boolean }).finalized) {
        failed = true;
        throw error;
      }
      return realWrite.call(this, file, data);
    },
  );
  try {
    await manager.flushNow();
    await expect(manager.finalize(meta)).rejects.toBe(error);
    expect(
      parseReproductionRecord(JSON.parse(await readFile(path.join(root, "mandatory/reproduction.json"), "utf8"))).finalized,
    ).toBe(true);
  } finally {
    write.mockRestore();
  }
});
