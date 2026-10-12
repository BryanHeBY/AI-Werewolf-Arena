/**
 * Recording boundary tests: one initialized World and literal timeout termination
 * produce a native zero-decision Tape whose parameters come from the bound owner.
 * Handwritten min-id, zero-cycle and old-source refusal assertions are the oracle;
 * native strict replay checks that same encoded data at the actual reader boundary.
 * Temporary files are cleaned, no game cycle, model or historical fixture is run.
 */
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createRandom } from "../../../src/core/domain/random";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { ReproductionTrace, type ReproductionMetadata } from "../../../src/recording/reproduction";
import {
  beginGameReproduction,
  currentEngineVersion,
} from "../../../src/runtime/simulation/reproduction_context";
import { replayReproduction } from "../../../src/runtime/simulation/replay_reproduction";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

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
