/**
 * 集成测试负责已返回但未完成候选的真实录制／阶段／重放接线。
 * 输入为合法六人 Hybrid、SessionRecordManager 与三次字面 null 或一个真实抛错；不接模型或网络。
 * 原 SessionRecorder 上下文收集必需领域操作，终结档仍由实际 manager 生成，不手工删去 operations。
 * 输出核对原库存、请求／结算序与精确失败快照；缺候选仍保旧异常，历史 shape 不豁免来源指纹。
 * 夹具目录由共享测试 owner 清理，不从生产资格函数计算玩法预期。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Role, WinCondition } from "../../../src/domain";
import { getHybridState } from "../../../src/features/hybrid/ports";
import { SessionRecordManager } from "../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../src/recording/session/context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../src/app/simulation/reproduction-context";
import {
  readReproduction,
  replayReproduction,
} from "../../../src/app/simulation/replay-reproduction";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

async function failedRecord(original?: Error, playerNames?: Readonly<Record<string, string>>) {
  const roles = [Role.Hybrid, Role.Wolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager];
  const game = bootstrapGame(
    {
      ...sixPlayerMvpConfig,
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((value) => value === role).length,
      })),
      winConditions: [WinCondition.SlaughterCity],
      selfDestruct: { enabledWindows: [] },
    },
    { fixedRoles: roles, locale: "en", playerNames },
  );
  const manager = await SessionRecordManager.create(
    {
      sessionId: "literal-hybrid-retry",
      board: "literal_hybrid_retry",
      locale: "en",
      startedAtIso: "2026-10-15T00:00:00.000Z",
    },
    await createTestTempDirectory("awa-returned-candidate-record-"),
  );
  let calls = 0,
    failure: unknown;
  await runWithSessionRecorder(manager, async () => {
    const trace = beginGameReproduction(manager, game, {
      engine: await currentEngineVersion(),
      boardId: "literal_hybrid_retry",
      locale: "en",
      maxDays: 2,
    });
    try {
      await game.phaseManager.runSingleCycle(
        {
          getAction(request) {
            calls++;
            return trace.decide(request, {
              getAction: async () => {
                if (original) throw original;
                return null;
              },
            });
          },
        },
        2,
      );
    } catch (error) {
      failure = error;
    }
    trace.checkpoint(
      captureCheckpoint(
        game.world,
        game.phaseManager.getSnapshot(),
        1,
        false,
        game.phaseManager.getEvents().length,
        failure,
      ),
      game.phaseManager.getEvents(),
    );
    manager.noteReproductionFailure("cycle", failure);
    // 与真实失败驱动一致：保留 manager 收集的完整操作，不能用空数组替代录制装配。
    await manager.finalize({
      endedAtIso: "2026-10-15T00:01:00.000Z",
      winner: null,
      finishReason: "runtime_error",
      players: [],
    });
  });
  const record = await readReproduction(path.join(manager.sessionDir, "reproduction.json"));
  return { game, record, failure, calls };
}

test("returned candidate: three real Hybrid null returns replay all retries and preserve the unpaid failure", async () => {
  const { game, record, failure, calls } = await failedRecord();
  expect((failure as Error).message).toBe("hybrid_valid_action_missing");
  expect(calls).toBe(3);
  expect(getHybridState(game.world.getComponent(1, COMPONENT.Role)!)).toEqual({
    remaining: 1,
    choice: null,
  });
  expect(game.world.getComponent(1, COMPONENT.Victory)!.affiliations).toEqual([]);
  expect(
    record.decisions.map((decision) => ({
      opened: decision.openedAfterSettlement,
      settle: decision.settleOrder,
      candidate: decision.returnedCandidate,
      outcome: decision.outcome,
    })),
  ).toEqual([
    {
      opened: 0,
      settle: 1,
      candidate: null,
      outcome: { kind: "error", code: "decision_failed", name: "Error" },
    },
    {
      opened: 1,
      settle: 2,
      candidate: null,
      outcome: { kind: "error", code: "decision_failed", name: "Error" },
    },
    {
      opened: 2,
      settle: 3,
      candidate: null,
      outcome: { kind: "error", code: "decision_failed", name: "Error" },
    },
  ]);
  const root = await createTestTempDirectory("awa-returned-candidate-replay-");
  expect((await replayReproduction(record, root)).snapshot).toEqual(
    game.phaseManager.getSnapshot(),
  );
});

test("returned candidate: a real provider throw stays absent and old Tape2 shape still rejects foreign source", async () => {
  const original = new TypeError("literal provider throw");
  // Tape2 的姓名原本必填：从真实开局提供字面姓名，不能把匿名 Tape3 仅改版本后冒充历史输入。
  const { game, record, failure, calls } = await failedRecord(original, {
    "1": "Legacy One",
    "2": "Legacy Two",
    "3": "Legacy Three",
    "4": "Legacy Four",
    "5": "Legacy Five",
    "6": "Legacy Six",
  });
  expect(failure).toBe(original);
  expect(calls).toBe(1);
  expect(Object.hasOwn(record.decisions[0]!, "returnedCandidate")).toBe(false);
  const legacyShape = structuredClone(record);
  legacyShape.schemaVersion = 2;
  const root = await createTestTempDirectory("awa-returned-candidate-legacy-");
  expect((await replayReproduction(legacyShape, root)).snapshot).toEqual(
    game.phaseManager.getSnapshot(),
  );
  const foreign = structuredClone(legacyShape);
  foreign.metadata.engine.sourceHash = "0".repeat(64);
  await expect(replayReproduction(foreign, root)).rejects.toThrow(
    "reproduction_engine_or_lock_incompatible",
  );
});
