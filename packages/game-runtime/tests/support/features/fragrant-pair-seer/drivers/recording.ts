/**
 * 持有本模块测试的受控执行与录制支持；输入为字面行动计划及原夹具句柄，输出保留驱动回调、轨迹、缓存和清理。真实生产流程仍由原驱动调用，不新增另一套生产状态写入算法；手写预期由调用方持有，传输／复现及脚本行动沿用原生命周期，不引入计费模型。
 */
import { fragrantLiteralPlans } from "../builders/literal-plans";
import { readFile } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { SessionRecordManager } from "../../../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../../../src/recording/session/context";
import { beginGameReproduction } from "../../../../../src/app/simulation/reproduction-context";
import { captureCheckpoint } from "../../../../../src/app/simulation/reproduction-context";
import { currentEngineVersion } from "../../../../../src/app/simulation/reproduction-context";
import { parseReproductionRecord } from "../../../../../src/recording/reproduction/format";
import { replayReproduction } from "../../../../../src/app/simulation/replay-reproduction";
import { fragrantRuntimeGame } from "../builders/runtime-game";
import { fragrantRuntimeAction } from "./actions";
import { fragrantPairSeerTwelveConfig } from "../../../../../src/rulesets/presets/fragrant-pair-seer-twelve";
import { createTestTempDirectory } from "../../../drivers/temp-directories";

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
        ...(void fragrantPairSeerTwelveConfig, {}),
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
