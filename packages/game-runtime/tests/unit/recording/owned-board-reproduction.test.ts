/**
 * 负责单元测试：录制板子所有权边界；输入为一个初始化 World 和字面超时终止，输出为零决定原生 Tape。
 * 原 min-id、零周期与旧来源拒绝断言为手写预期，原生严格 reader 核对同一编码数据。
 * 清理临时文件，不执行对局周期、模型或历史 fixture。
 */
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createRandom } from "../../../src/domain/random";
import { SessionRecordManager } from "../../../src/recording/session/recorder";
import { type ReproductionMetadata } from "../../../src/recording/reproduction/format";
import { ReproductionTrace } from "../../../src/recording/reproduction/trace";
import {
  beginGameReproduction,
  currentEngineVersion,
} from "../../../src/app/simulation/reproduction-context";
import { replayReproduction } from "../../../src/app/simulation/replay-reproduction";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

test("actual writer and strict zero-cycle reader share owned board data without an archive revision field", async () => {
  const input = structuredClone(sixPlayerMvpConfig);
  input.tieBreaker = { wolfKillVote: "min_id" };
  const context = bootstrapGame(input, { random: createRandom("owned-zero-cycle"), locale: "en" });
  input.tieBreaker.wolfKillVote = "no_kill";
  const manager: SessionRecordManager = Object.create(SessionRecordManager.prototype);
  Object.defineProperty(manager, "beginReproduction", {
    value(metadata: ReproductionMetadata) {
      return new ReproductionTrace(metadata, () => {});
    },
  });
  const trace = beginGameReproduction(manager, context, {
    engine: await currentEngineVersion(),
    boardId: "six_player_mvp",
    locale: context.world.locale,
    maxDays: 1,
  });
  const record = trace.build({
    operations: [],
    termination: { reason: "runtime_timeout", winner: null },
  });
  expect(record.metadata.normalizedBoard.tieBreaker!.wolfKillVote).toBe("min_id");
  expect(record.decisions).toHaveLength(0);
  expect(record.checkpoints).toHaveLength(1);
  expect(Object.hasOwn(record.metadata, "revision")).toBe(false);
  const root = await mkdtemp(path.join(os.tmpdir(), "awa-owned-board-replay-"));
  try {
    const restored = await replayReproduction(record, root);
    expect(restored.decisionCount).toBe(0);
    expect(restored.snapshot).toEqual(context.phaseManager.getSnapshot());
    const oldSource = structuredClone(record);
    oldSource.metadata.engine.sourceHash = "0".repeat(64);
    await expect(replayReproduction(oldSource, root)).rejects.toThrow(
      "reproduction_engine_or_lock_incompatible",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
