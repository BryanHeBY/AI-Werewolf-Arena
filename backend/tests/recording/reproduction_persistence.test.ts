import { expect, spyOn, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { bootstrapGame } from "../../src/app/bootstrap";
import { createRandom, Phase, Role, type ActionRequest } from "../../src/core";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { ReplayFileStore } from "../../src/recording/file_store";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../src/runtime/simulation/reproduction_context";
import { GameEventRecorder } from "../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../support/temp_directory";
import { BaselineBotActionProvider } from "../../src/ai/agents/providers/action_providers";
import { runWithSessionRecorder } from "../../src/recording/recording_context";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";

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
    boardConfig: sixPlayerMvpConfig,
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
        (file !== "reproduction.json" || (data as { finalized?: boolean }).finalized)
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
    const replay = JSON.parse(await readFile(path.join(root, "mandatory/replay.json"), "utf8"));
    expect(replay.result.reason).toBe("runtime_error");
    const partial = JSON.parse(
      await readFile(path.join(root, "mandatory/reproduction.json"), "utf8"),
    );
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
      if (!paused && file === "reproduction.json" && !(data as { finalized: boolean }).finalized) {
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
    expect(JSON.parse(await readFile(file, "utf8")).finalized).toBe(true);
    await new Promise((done) => setTimeout(done, 160));
    await manager.flushNow();
    expect(JSON.parse(await readFile(file, "utf8")).finalized).toBe(true);
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
      if (!failed && file === "reproduction.json" && !(data as { finalized: boolean }).finalized) {
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
      JSON.parse(await readFile(path.join(root, "mandatory/reproduction.json"), "utf8")).finalized,
    ).toBe(true);
  } finally {
    write.mockRestore();
  }
});

test("a fixed deal with an injected named root stream reproduces in its declared mode", async () => {
  const root = await createTestTempDirectory("awa-fixed-record-");
  const output = await createTestTempDirectory("awa-fixed-replay-");
  const context = bootstrapGame(sixPlayerMvpConfig, {
    random: createRandom("fixed-root").fork("fixture"),
    fixedRoles: [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager],
  });
  const manager = await SessionRecordManager.create(
    { sessionId: "fixed", board: "six_player_mvp", startedAtIso: "2026-10-07T00:00:00.000Z" },
    root,
  );
  const trace = beginGameReproduction(manager, context, {
    engine: await currentEngineVersion(),
    boardId: "six_player_mvp",
    boardConfig: sixPlayerMvpConfig,
    locale: "zh-CN",
    maxDays: 30,
  });
  const baseline = new BaselineBotActionProvider(context.world);
  const provider = { getAction: (request: ActionRequest) => trace.decide(request, baseline) };
  const recorder = new GameEventRecorder(
    { world: context.world, replayManager: manager },
    Phase.Night,
  );
  await runWithSessionRecorder(manager, async () => {
    let cycle = 0;
    while (!context.phaseManager.getSnapshot().gameOver) {
      await context.phaseManager.runSingleCycle(provider, 30);
      trace.checkpoint(
        captureCheckpoint(
          context.world,
          context.phaseManager.getSnapshot(),
          ++cycle,
          true,
          context.phaseManager.getEvents().length,
        ),
        context.phaseManager.getEvents(),
      );
      recorder.flush(context.phaseManager.getEvents());
    }
    const snapshot = context.phaseManager.getSnapshot();
    await manager.finalize({
      endedAtIso: "2026-10-07T00:01:00.000Z",
      winner: snapshot.result!.winner,
      finishReason: snapshot.result!.reason,
      players: captureCheckpoint(context.world, snapshot, cycle, true, 0).players.map((player) => ({
        player_id: player.id,
        role: player.role,
        camp: player.camp,
        alive: player.alive,
      })),
    });
  });
  const record = await readReproduction(path.join(root, "fixed/reproduction.json"));
  expect(record.metadata.dealMode).toBe("fixed");
  expect(record.metadata.random.path).toEqual(["fixture"]);
  expect((await replayReproduction(record, output)).snapshot).toEqual(
    context.phaseManager.getSnapshot(),
  );
});
