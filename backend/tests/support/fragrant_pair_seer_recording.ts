import { readFile, rm } from "node:fs/promises";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../src/recording/recording_context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../src/runtime/simulation/reproduction_context";
import { parseReproductionRecord } from "../../src/recording/reproduction";
import { replayReproduction } from "../../src/runtime/simulation/replay_reproduction";
import {
  fragrantRuntimeGame,
  fragrantRuntimeAction,
  type FragrantRuntimePlan,
} from "./fragrant_pair_seer_scenarios";
import { fragrantPairSeerTwelveConfig } from "../../src/runtime/scenarios/fragrant_pair_seer_twelve";
import { createTestTempDirectory } from "./drivers/temp-directories";
export const fragrantLiteralPlans: Record<string, readonly FragrantRuntimePlan[]> = {
  inherited_gun: [
    { bind: null, knife: 9, poison: 2, exile: 3 },
    { bind: null, knife: 10, exile: 4 },
    { bind: [1, 12], knife: 11, shoot: 1 },
  ],
  first_link: [
    { bind: [5, 6], knife: 5, exile: 2 },
    { knife: 7, exile: 3 },
    { knife: 8, exile: 4 },
  ],
  expiry: [
    { bind: [5, 6], knife: null, exile: 2 },
    { bind: null, knife: 7, exile: 3 },
    { bind: [5, 6], knife: 5, exile: 4 },
    { knife: null, exile: 1 },
  ],
};
export async function recordFragrantLiteral(
  name = "inherited_gun",
  locale: "zh-CN" | "en" = "zh-CN",
  failureStage?: string,
) {
  const game = fragrantRuntimeGame(locale),
    root = await createTestTempDirectory("awa-fragrant-ledger-");
  let manager: SessionRecordManager | undefined;
  try {
    manager = await SessionRecordManager.create(
      {
        sessionId: "game",
        board: "awa_fragrant_pair_seer_12_v1",
        locale,
        startedAtIso: new Date().toISOString(),
        random: game.random.metadata,
      },
      root,
    );
    const active = manager;
    await runWithSessionRecorder(active, async () => {
      const trace = beginGameReproduction(active, game, {
        engine: await currentEngineVersion(),
        boardId: "awa_fragrant_pair_seer_12_v1",
        boardConfig: fragrantPairSeerTwelveConfig,
        locale,
        maxDays: 8,
      });
      for (let cycle = 1; cycle <= 8 && !game.phaseManager.getSnapshot().gameOver; cycle++) {
        let failure: unknown;
        try {
          await game.phaseManager.runSingleCycle(
            {
              getAction: (q) =>
                trace.decide(q, {
                  async getAction(r) {
                    if (r.context.stage === failureStage) return null;
                    const plan = fragrantLiteralPlans[name]?.[r.context.day - 1];
                    if (!plan) throw Error("fragrant_literal_plan_exhausted");
                    return fragrantRuntimeAction(r, plan);
                  },
                }),
            },
            8,
          );
        } catch (e) {
          failure = e;
          trace.noteFailure("cycle", e);
          if (!failureStage) throw e;
        }
        trace.checkpoint(
          captureCheckpoint(
            game.world,
            game.phaseManager.getSnapshot(),
            cycle,
            failure === undefined,
            game.phaseManager.getEvents().length,
            failure,
          ),
          game.phaseManager.getEvents(),
        );
        trace.build();
        if (failure) break;
      }
      const snap = game.phaseManager.getSnapshot();
      if (!failureStage && (!snap.gameOver || snap.result?.reason === "max_days_reached"))
        throw Error("fragrant_literal_not_natural");
      await active.finalize({
        endedAtIso: new Date().toISOString(),
        winner: snap.result?.winner ?? null,
        finishReason: failureStage ? "runtime_error" : snap.result!.reason,
        ...(snap.result ? { gameResult: snap.result } : {}),
        players: captureCheckpoint(
          game.world,
          snap,
          0,
          true,
          game.phaseManager.getEvents().length,
        ).players.map((p) => ({ player_id: p.id, role: p.role, camp: p.camp, alive: p.alive })),
      });
    });
    const record = parseReproductionRecord(
        JSON.parse(await readFile(manager.sessionDir + "/reproduction.json", "utf8")),
      ),
      replay = await replayReproduction(record, root + "/tape");
    return { record, replay };
  } finally {
    await manager
      ?.finalize({
        endedAtIso: new Date().toISOString(),
        winner: null,
        finishReason: "runtime_error",
        players: [],
      })
      .catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }
}
