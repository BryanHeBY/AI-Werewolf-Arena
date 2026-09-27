import { afterEach, expect, spyOn, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PhaseManager } from "../../src/game/engine/phase_manager";
import { ReplayFileStore } from "../../src/observability/replay_file_store";
import { SessionRecordHub } from "../../src/observability/session_record_manager";
import { setRuntimeConfigOverride } from "../../src/runtime/config/runtime_config";
import { runLlmGame, type RunLlmGameOptions } from "../../src/runtime/run_llm_game";
import { cleanupTestTempDirectories, createTestTempDirectory } from "../support/temp_directory";

const restores: Array<() => void> = [];
afterEach(async () => {
  for (const restore of restores.splice(0)) restore();
  setRuntimeConfigOverride(null);
  SessionRecordHub.setActive(null);
  await cleanupTestTempDirectories();
});

async function options(): Promise<RunLlmGameOptions> {
  setRuntimeConfigOverride({
    providers: { default: "local", items: { local: { type: "openai", apiKey: "unused", baseURL: "http://127.0.0.1:1" } } },
    agents: { default: "local", items: { local: { kind: "llm", provider: "local", model: "unused" } } },
    game: { agent: "local" },
    debugSummary: { agent: { enabled: false } },
  });
  return {
    board: "six_player_mvp", maxDays: 1, maxRuntimeMs: 1000, llmTimeoutMs: 10,
    trace: false, printAllEvents: false, printChat: false, streamEvents: false,
    color: false, printLlmIo: false, printThinking: false, printPrivateEvents: false,
    recordRootDir: await createTestTempDirectory("awa-run-lifecycle-"),
  };
}

async function replay(root: string) {
  const [session] = await fs.readdir(root);
  return JSON.parse(await fs.readFile(path.join(root, session, "replay.json"), "utf8"));
}

test("a failed game seals its partial replay and releases the active recorder", async () => {
  const config = await options();
  const failure = new Error("cycle failed");
  const cycle = spyOn(PhaseManager.prototype, "runSingleCycle").mockRejectedValue(failure);
  restores.push(() => cycle.mockRestore());
  await expect(runLlmGame(config)).rejects.toBe(failure);
  const document = await replay(config.recordRootDir!);
  expect(document.result).toEqual({ winner: null, reason: "runtime_error" });
  expect(document.players.map((player: { player_id: number }) => player.player_id)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(document.events.map((event: { type: string }) => event.type)).toEqual(["god_private_game_info", "phase_changed"]);
  expect(SessionRecordHub.getActive()).toBeNull();
});

test("failure to persist the final replay rejects the game result", async () => {
  const config = await options();
  const write = ReplayFileStore.prototype.writeJsonStrict;
  const failure = new Error("disk full at finalize");
  let writes = 0;
  const strictWrite = spyOn(ReplayFileStore.prototype, "writeJsonStrict").mockImplementation(async function (file, data) {
    if (++writes > 1) throw failure;
    await write.call(this, file, data);
  });
  restores.push(() => strictWrite.mockRestore());
  await expect(runLlmGame({ ...config, maxRuntimeMs: 0 })).rejects.toBe(failure);
  expect(SessionRecordHub.getActive()).toBeNull();
});

test("a finalization failure does not hide the original game error", async () => {
  const config = await options();
  const primary = new Error("cycle failed");
  const secondary = new Error("disk full");
  const cycle = spyOn(PhaseManager.prototype, "runSingleCycle").mockRejectedValue(primary);
  const write = ReplayFileStore.prototype.writeJsonStrict;
  let writes = 0;
  const strictWrite = spyOn(ReplayFileStore.prototype, "writeJsonStrict").mockImplementation(async function (file, data) {
    if (++writes > 1) throw secondary;
    await write.call(this, file, data);
  });
  restores.push(() => cycle.mockRestore(), () => strictWrite.mockRestore());
  let caught: unknown;
  try { await runLlmGame(config); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(AggregateError);
  expect((caught as AggregateError).errors).toEqual([primary, secondary]);
  expect(SessionRecordHub.getActive()).toBeNull();
});
