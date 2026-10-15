/**
 * Owns original test driver animal-dream controlled execution and recording support. Inputs are literal action plans
 * and original fixture handles; outputs preserve driver callbacks, traces, caches and cleanup. Concrete
 * transport/replay or scripted actions retain their original lifetimes; supplied handwritten oracles own
 * expected outcomes, and no billed model or production state writer is introduced.
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
