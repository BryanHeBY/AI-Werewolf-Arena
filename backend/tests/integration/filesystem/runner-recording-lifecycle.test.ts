/**
 * 负责文件系统集成测试，核对失败 runner 封存部分归档并释放活动录制 scope。
 * 输入为真实 runner、阶段／终结注入失败、原恢复钩子与临时目录；输出由原部分复盘字面内容及首要／持久化错误身份核对。
 * 保留终结顺序，无须成功模型对局；新文件封装只在原读取点解包，不生成预期。
 */
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { afterEach, expect, spyOn, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PhaseManager } from "../../../src/engine/phase-manager";
import { ReplayFileStore } from "../../../src/adapters/filesystem/session-file-store";
import { getSessionRecorder } from "../../../src/recording/session/context";
import { resolveGameSetup } from "../../../src/app/config/resolve-game-setup";
import type { ResolvedGameSetup } from "../../../src/app/config/resolve-game-setup";
import { runGame } from "../../../src/app/game-runner";
import { cleanupTestTempDirectories, createTestTempDirectory } from "../../support/drivers/temp-directories";

const restores: Array<() => void> = [];
afterEach(async () => {
  for (const restore of restores.splice(0)) restore();
  await cleanupTestTempDirectories();
});

async function options(): Promise<{ setup: ResolvedGameSetup }> {
  const runtime = {
    providers: {
      default: "local",
      items: { local: { type: "openai", apiKey: "unused", baseURL: "http://127.0.0.1:1" } },
    },
    agents: {
      default: "local",
      items: { local: { kind: "llm", provider: "local", model: "unused" } },
    },
    game: { agent: "local" },
    debugSummary: { agent: { enabled: false } },
  } as const;
  const setup = resolveGameSetup(runtime);
  return {
    setup: {
      ...setup,
      options: {
        ...setup.options,
        board: "six_player_mvp",
        maxDays: 1,
        maxRuntimeMs: 1000,
        llmTimeoutMs: 10,
        streamEvents: false,
        recordRootDir: await createTestTempDirectory("awa-run-lifecycle-"),
      },
    },
  };
}

async function replay(root: string) {
  const [session] = await fs.readdir(root);
  return readReplayDocument(JSON.parse(await fs.readFile(path.join(root, session, "replay.json"), "utf8")));
}

test("a failed game seals its partial replay and releases the active recorder", async () => {
  const config = await options();
  const failure = new Error("cycle failed");
  const cycle = spyOn(PhaseManager.prototype, "runSingleCycle").mockRejectedValue(failure);
  restores.push(() => cycle.mockRestore());
  await expect(runGame(config.setup)).rejects.toBe(failure);
  const root = config.setup.options.recordRootDir!;
  const document = await replay(root);
  expect(document.result).toEqual({ winner: null, reason: "runtime_error" });
  expect(document.players.map((player: { player_id: number }) => player.player_id)).toEqual([
    1, 2, 3, 4, 5, 6,
  ]);
  expect(document.events.map((event: { type: string }) => event.type)).toEqual([
    "god_private_game_info",
    "phase_changed",
  ]);
  expect(getSessionRecorder()).toBeNull();
});

test("failure to persist the final replay rejects the game result", async () => {
  const config = await options();
  const write = ReplayFileStore.prototype.writeJsonStrict;
  const failure = new Error("disk full at finalize");
  const strictWrite = spyOn(ReplayFileStore.prototype, "writeJsonStrict").mockImplementation(
    async function (this: ReplayFileStore, file, data) {
      const reason = (data as { result?: { reason?: string | null } }).result?.reason;
      if (file === "replay.json" && reason && reason !== "in_progress") throw failure;
      await write.call(this, file, data);
    },
  );
  restores.push(() => strictWrite.mockRestore());
  await expect(
    runGame({ ...config.setup, options: { ...config.setup.options, maxRuntimeMs: 0 } }),
  ).rejects.toBe(failure);
  expect(getSessionRecorder()).toBeNull();
});

test("a finalization failure does not hide the original game error", async () => {
  const config = await options();
  const primary = new Error("cycle failed");
  const secondary = new Error("disk full");
  const cycle = spyOn(PhaseManager.prototype, "runSingleCycle").mockRejectedValue(primary);
  const write = ReplayFileStore.prototype.writeJsonStrict;
  const strictWrite = spyOn(ReplayFileStore.prototype, "writeJsonStrict").mockImplementation(
    async function (this: ReplayFileStore, file, data) {
      const reason = (data as { result?: { reason?: string | null } }).result?.reason;
      if (file === "replay.json" && reason && reason !== "in_progress") throw secondary;
      await write.call(this, file, data);
    },
  );
  restores.push(
    () => cycle.mockRestore(),
    () => strictWrite.mockRestore(),
  );
  let caught: unknown;
  try {
    await runGame(config.setup);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AggregateError);
  expect((caught as AggregateError).errors).toEqual([primary, secondary]);
  expect(getSessionRecorder()).toBeNull();
});
