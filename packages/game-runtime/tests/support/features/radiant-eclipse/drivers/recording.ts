/**
 * 持有本模块测试的受控执行与录制支持；输入为字面行动计划及原夹具句柄，输出保留驱动回调、轨迹、缓存和清理。真实生产流程仍由原驱动调用，不新增另一套生产状态写入算法；手写预期由调用方持有，传输／复现及脚本行动沿用原生命周期，不引入计费模型。
 */
import type { RadiantFullPlanName } from "../oracles/literal-plans";
import type { BootstrapResult } from "../../../../../src/app/bootstrap";
import type { ActionProvider } from "../../../../../src/domain";
import type { ActionRequest } from "../../../../../src/domain";
import { radiantManualAction } from "./manual-actions";
import { readFile } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { bootstrapGame } from "../../../../../src/app/bootstrap";
import { createRandom } from "../../../../../src/domain";
import { radiantRoles } from "../builders/runtime-game";
import { radiantProvider } from "./actions";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import { SessionRecordManager } from "../../../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../../../src/recording/session/context";
import { parseReproductionRecord } from "../../../../../src/recording/reproduction/format";
import type { RecordedCheckpoint } from "../../../../../src/recording/reproduction/format";
import type { ReproductionRecord } from "../../../../../src/recording/reproduction/format";
import { beginGameReproduction } from "../../../../../src/app/simulation/reproduction-context";
import { captureCheckpoint } from "../../../../../src/app/simulation/reproduction-context";
import { currentEngineVersion } from "../../../../../src/app/simulation/reproduction-context";
import { replayReproduction } from "../../../../../src/app/simulation/replay-reproduction";
import { GameEventRecorder } from "../../../../../src/app/game-event-recorder";
import { createTestTempDirectory } from "../../../drivers/temp-directories";

export interface RadiantRecordingOptions {
  locale?: "zh-CN" | "en";
  planName?: RadiantFullPlanName;
  seed?: string;
  failureStage?: ActionRequest["context"]["stage"];
  failureMode?: "missing" | "error";
  artifactDirectory?: string;
  provider?: (
    game: BootstrapResult,
    manual: ActionProvider,
  ) => Promise<ActionProvider> | ActionProvider;
}

export async function radiantRecording(
  options: RadiantRecordingOptions = {},
): Promise<ReproductionRecord> {
  const locale = options.locale ?? "en",
    seed = options.seed ?? "radiant-eclipse-real-recording";
  const board = parseBoardDefinition(
    JSON.parse(
      await readFile(
        new URL(
          "../../../../../../../configs.example/boards/awa_radiant_eclipse_12_v1.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  const game = bootstrapGame(board.config, {
    locale,
    fixedRoles: radiantRoles,
    random: createRandom(seed),
  });
  const root = await createTestTempDirectory("awa-radiant-tape-");
  try {
    const manager = await SessionRecordManager.create(
      {
        sessionId: "game",
        board: board.definition.id,
        startedAtIso: new Date().toISOString(),
        locale,
        random: game.random.metadata,
      },
      root,
    );
    const recorder = new GameEventRecorder(
      { world: game.world, replayManager: manager },
      game.phaseManager.getSnapshot().phase,
    );
    const manual = radiantProvider([], {}, (q) => {
      if (q.context.day === 2 && q.context.stage === options.failureStage) {
        if (options.failureMode === "error") throw new Error("synthetic_radiant_provider_failure");
        return null;
      }
      return radiantManualAction(q, options.planName);
    });
    const provider = options.provider ? await options.provider(game, manual) : manual;
    let last: RecordedCheckpoint | undefined;
    await runWithSessionRecorder(manager, async () => {
      const trace = beginGameReproduction(manager, game, {
        engine: await currentEngineVersion(),
        boardId: board.definition.id,
        ...(void board.config, {}),
        locale,
        maxDays: 6,
      });
      for (let cycle = 1; cycle <= 6 && !game.phaseManager.getSnapshot().gameOver; cycle++) {
        let failure: unknown;
        try {
          await game.phaseManager.runSingleCycle(
            { getAction: (q) => trace.decide(q, provider) },
            6,
          );
        } catch (error) {
          if (!options.failureStage) throw error;
          failure = error;
          trace.noteFailure("cycle", error);
        }
        last = captureCheckpoint(
          game.world,
          game.phaseManager.getSnapshot(),
          cycle,
          failure === undefined,
          game.phaseManager.getEvents().length,
          failure,
        );
        trace.checkpoint(last, game.phaseManager.getEvents());
        recorder.flush(game.phaseManager.getEvents());
        if (failure) break;
      }
      const snapshot = game.phaseManager.getSnapshot();
      if (options.failureStage) {
        if (last?.complete || snapshot.gameOver) throw Error("radiant_fixture_failed_to_fail");
      } else if (!snapshot.gameOver || snapshot.result?.reason === "max_days_reached")
        throw Error("radiant_fixture_failed_to_end_naturally");
      await manager.finalize({
        endedAtIso: new Date().toISOString(),
        winner: snapshot.result?.winner ?? null,
        finishReason: options.failureStage ? "runtime_error" : snapshot.result!.reason,
        ...(snapshot.result ? { gameResult: snapshot.result } : {}),
        players: last!.players.map((p) => ({
          player_id: p.id,
          role: p.role,
          camp: p.camp,
          alive: p.alive,
        })),
      });
    });
    const record = parseReproductionRecord(
      JSON.parse(await readFile(path.join(manager.sessionDir, "reproduction.json"), "utf8")),
    );
    const replay = await replayReproduction(record, root);
    if (JSON.stringify(replay.snapshot) !== JSON.stringify(record.checkpoints.at(-1)!.snapshot))
      throw Error("radiant_fixture_replay_changed_snapshot");
    if (options.artifactDirectory) {
      await mkdir(options.artifactDirectory, { recursive: true });
      for (const name of [
        "reproduction.json",
        "replay.json",
        "manifest.json",
        "phase_windows.json",
        "timeline_index.json",
      ])
        await copyFile(
          path.join(manager.sessionDir, name),
          path.join(options.artifactDirectory, name),
        );
      await mkdir(path.join(options.artifactDirectory, "players"), { recursive: true });
      for (let actor = 1; actor <= 12; actor++)
        await copyFile(
          path.join(manager.sessionDir, `players/player_${actor}.json`),
          path.join(options.artifactDirectory, `players/player_${actor}.json`),
        );
    }
    return record;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
