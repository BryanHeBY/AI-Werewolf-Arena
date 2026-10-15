/**
 * 持有本模块测试的受控执行与录制支持；输入为字面行动计划及原夹具句柄，输出保留驱动回调、轨迹、缓存和清理。真实生产流程仍由原驱动调用，不新增另一套生产状态写入算法；手写预期由调用方持有，传输／复现及脚本行动沿用原生命周期，不引入计费模型。
 */
import { readFile } from "node:fs/promises";
import { SessionRecordManager } from "../../../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../../../src/recording/session/context";
import { beginGameReproduction } from "../../../../../src/app/simulation/reproduction-context";
import { captureCheckpoint } from "../../../../../src/app/simulation/reproduction-context";
import { currentEngineVersion } from "../../../../../src/app/simulation/reproduction-context";
import { GameEventRecorder } from "../../../../../src/app/game-event-recorder";
import { parseReproductionRecord } from "../../../../../src/recording/reproduction/format";
import { replayReproduction } from "../../../../../src/app/simulation/replay-reproduction";
import { animalGame } from "../builders/runtime-game";
import { animalBoard } from "../builders/runtime-game";
import { animalAction } from "./actions";
import { animalGolden } from "../oracles/golden";
import type { AnimalPlan } from "../contracts";
import { createTestTempDirectory } from "../../../drivers/temp-directories";

export async function recordAnimalLiteral(
  name: AnimalPlan = "fox_beauty",
  locale: "zh-CN" | "en" = "zh-CN",
  skip = false,
  first = false,
  failureStage?: string,
) {
  const g = animalGame(locale, skip, first),
    root = await createTestTempDirectory("awa-animal-record-");
  const manager = await SessionRecordManager.create(
    {
      sessionId: "game",
      board: "animal_dream",
      locale,
      startedAtIso: new Date().toISOString(),
      random: g.random.metadata,
    },
    root,
  );
  const recorder = new GameEventRecorder(
    { world: g.world, replayManager: manager },
    g.phaseManager.getSnapshot().phase,
  );
  await runWithSessionRecorder(manager, async () => {
    const trace = beginGameReproduction(manager, g, {
      engine: await currentEngineVersion(),
      boardId: "animal_dream",
      ...(void animalBoard(skip, first), {}),
      locale,
      maxDays: 8,
    });
    for (
      let cycle = 1;
      cycle <= animalGolden(name, skip, first).days && !g.phaseManager.getSnapshot().gameOver;
      cycle++
    ) {
      let failure: unknown;
      try {
        await g.phaseManager.runSingleCycle(
          {
            getAction: (q) =>
              trace.decide(q, {
                getAction: async (r) =>
                  r.context.stage === failureStage ? null : animalAction(r, name, first),
              }),
          },
          8,
        );
      } catch (e) {
        failure = e;
        trace.noteFailure("cycle", e);
        if (!failureStage) throw e;
      }
      recorder.flush(g.phaseManager.getEvents());
      trace.checkpoint(
        captureCheckpoint(
          g.world,
          g.phaseManager.getSnapshot(),
          cycle,
          !failure,
          g.phaseManager.getEvents().length,
          failure,
        ),
        g.phaseManager.getEvents(),
      );
      if (failure) break;
    }
    const s = g.phaseManager.getSnapshot();
    await manager.finalize({
      endedAtIso: new Date().toISOString(),
      winner: s.result?.winner ?? null,
      finishReason: failureStage ? "runtime_error" : s.result!.reason,
      ...(s.result ? { gameResult: s.result } : {}),
      players: captureCheckpoint(
        g.world,
        s,
        0,
        !failureStage,
        g.phaseManager.getEvents().length,
      ).players.map((p) => ({ player_id: p.id, role: p.role, camp: p.camp, alive: p.alive })),
    });
  });
  const record = parseReproductionRecord(
    JSON.parse(await readFile(manager.sessionDir + "/reproduction.json", "utf8")),
  );
  const replay = await replayReproduction(record, root + "/tape");
  return { record, replay, root, manager, g };
}
