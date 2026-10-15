/**
 * 文件系统集成测试验证实际管理器的 closing／closed 边界、重复终结及初始化失败顺序。
 * 输入为手写录制操作、临时目录及可暂停或失败的严格写入；预期为明确文件内容和原错误身份。
 * 不运行完整对局、不使用模型，不从生产规则或旧档重生成测试预期；所有 spy 在 finally 恢复。
 */
import { readReplayManifest } from "@ai-werewolf-arena/replay-contract";
import { expect, spyOn, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SessionRecordManager } from "../../../../src/recording/session/recorder";
import { ReplayFileStore } from "../../../../src/adapters/filesystem/session-file-store";
import type { ReplayFinalizeMeta } from "../../../../src/recording/contracts";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

const session = {
  sessionId: "literal-lifecycle",
  board: "literal-board",
  startedAtIso: "2026-10-13T00:00:00.000Z",
};
const meta: ReplayFinalizeMeta = {
  endedAtIso: "2026-10-13T00:00:01.000Z",
  winner: null,
  finishReason: "first_finish",
  players: [],
};

test("closing joins the prefix while final files are held and reuses the first finalization", async () => {
  const root = await createTestTempDirectory("awa-life-owner-");
  const manager = await SessionRecordManager.create(session, root);
  const held = Promise.withResolvers<void>(),
    started = Promise.withResolvers<void>();
  const original = ReplayFileStore.prototype.writeJsonStrict;
  const write = spyOn(ReplayFileStore.prototype, "writeJsonStrict").mockImplementation(
    async function (this: ReplayFileStore, file, data) {
      if (file === "manifest.json") {
        started.resolve();
        await held.promise;
      }
      return original.call(this, file, data);
    },
  );
  let finalization: ReturnType<SessionRecordManager["finalize"]> | undefined;
  try {
    manager.recordLogicOp({ scope: "gateway", op: "before_close", status: "ok" });
    finalization = manager.finalize(meta);
    expect(manager.finalize({ ...meta, finishReason: "ignored_second_finish" })).toBe(finalization);
    expect(() =>
      manager.recordRequiredLogicOp({ scope: "gateway", op: "forbidden", status: "ok" }),
    ).toThrow("mandatory_logic_op_recording_closed");
    // 首次队列尚未启动时，普通记录仍按旧语义进入本次前缀；不会新排定时器。
    manager.recordLogicOp({ scope: "gateway", op: "during_closing", status: "ok" });
    await started.promise;
    await manager.flushNow();
    manager.recordLogicOp({ scope: "gateway", op: "after_closed", status: "ok" });
    held.resolve();
    await finalization;
    const manifest = readReplayManifest(
      JSON.parse(await readFile(path.join(manager.sessionDir, "manifest.json"), "utf8")),
    );
    const logic = JSON.parse(
      await readFile(path.join(manager.sessionDir, "logic_ops.json"), "utf8"),
    );
    expect(manifest.finish_reason).toBe("first_finish");
    expect(logic.ops.map((op: { op: string }) => op.op)).toEqual([
      "before_close",
      "during_closing",
    ]);
  } finally {
    held.resolve();
    if (finalization) await finalization.catch(() => {});
    write.mockRestore();
  }
});

test("initial required writes retain all failures in launch order before returning a manager", async () => {
  const root = await createTestTempDirectory("awa-life-init-");
  const errors = [
    new Error("literal_manifest_init_failure"),
    new Error("literal_replay_init_failure"),
  ];
  const writes: string[] = [];
  const write = spyOn(ReplayFileStore.prototype, "writeJsonStrict").mockImplementation(
    async function (file) {
      writes.push(file);
      if (file === "manifest.json") throw errors[0];
      if (file === "replay.json") throw errors[1];
    },
  );
  try {
    let caught: unknown;
    try {
      await SessionRecordManager.create(session, root);
    } catch (error) {
      caught = error;
    }
    expect(writes).toEqual(["manifest.json", "replay.json"]);
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).message).toBe("session_record_initialization_failed");
    expect((caught as AggregateError).errors).toEqual(errors);
  } finally {
    write.mockRestore();
  }
});
