import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadBoardOverride } from "../../src/runtime/config/load_board_override";
import { loadRuntimeConfig } from "../../src/runtime/config/load_config";
import { resolveBoardConfig } from "../../src/runtime/scenarios/board_config_resolver";
import { createTestTempDirectory } from "../support/temp_directory";

async function writeRuntimeFiles(root: string, overrides: { providers?: unknown; agents?: unknown; game?: unknown; debugSummary?: unknown } = {}): Promise<void> {
  await fs.mkdir(path.join(root, "runtime"), { recursive: true });
  await fs.mkdir(path.join(root, "games"), { recursive: true });
  await fs.writeFile(path.join(root, "runtime", "providers.json"), JSON.stringify(overrides.providers ?? { default: "test_openai", items: { test_openai: { type: "openai", apiKey: "test-key" } } }));
  await fs.writeFile(path.join(root, "runtime", "agents.json"), JSON.stringify(overrides.agents ?? { default: "test_agent", items: { test_agent: { kind: "llm", provider: "test_openai", model: "test-model" } } }));
  await fs.writeFile(path.join(root, "games", "strict.json"), JSON.stringify(overrides.game ?? { board: "six_player_mvp", agent: "test_agent" }));
  if (overrides.debugSummary !== undefined) await fs.writeFile(path.join(root, "runtime", "debug_summary.json"), JSON.stringify(overrides.debugSummary));
}

test("loads only the explicit config directory and game name", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-");
  await writeRuntimeFiles(root, { game: { board: "twelve_player_standard", agent: "test_agent", playerAgents: { "1": "test_agent" } } });
  const runtime = await loadRuntimeConfig({ configDir: root, gameName: "strict" });
  expect(runtime.providers.default).toBe("test_openai");
  expect(runtime.game.board).toBe("twelve_player_standard");
});

test("rejects legacy provider and agent shapes", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-legacy-");
  await writeRuntimeFiles(root, { providers: { type: "openai", apiKey: "test-key" }, agents: { default: { model: "test-model" } } });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow("runtime_config_unknown_field: providers.type");
});

test("rejects inline audit model overrides", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-debug-");
  await writeRuntimeFiles(root, { debugSummary: { agent: { profile: { model: "different-model" } } } });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow("runtime_config_unknown_field: debugSummary.agent.profile");
});

test("loads a board override before pure board resolution", async () => {
  const root = await createTestTempDirectory("awa-board-config-");
  await fs.mkdir(path.join(root, "boards"));
  await fs.writeFile(path.join(root, "boards", "six_player_mvp.json"), JSON.stringify({
    mechanisms: { sheriff: { enabled: true } },
  }));

  const override = await loadBoardOverride(root, "six_player_mvp");
  await fs.writeFile(path.join(root, "boards", "six_player_mvp.json"), "{ invalid json");

  expect(resolveBoardConfig("six_player_mvp", override).enableSheriff).toBe(true);
  expect(resolveBoardConfig("six_player_mvp").enableSheriff).toBe(false);
});

test("rejects a present invalid board file instead of falling back to the base board", async () => {
  const root = await createTestTempDirectory("awa-board-config-invalid-");
  await fs.mkdir(path.join(root, "boards"));
  const file = path.join(root, "boards", "six_player_mvp.json");
  await fs.writeFile(file, JSON.stringify({ unexpected: true }));
  await expect(loadBoardOverride(root, "six_player_mvp")).rejects.toThrow("board_config_invalid_override");
  await fs.writeFile(file, JSON.stringify({ mechanisms: { sheriff: { enabled: "yes" } } }));
  await expect(loadBoardOverride(root, "six_player_mvp")).rejects.toThrow("board_config_invalid_override_field: mechanisms.sheriff.enabled");
  await fs.writeFile(file, "{ invalid json");
  await expect(loadBoardOverride(root, "six_player_mvp")).rejects.toThrow("board_config_json_invalid");
});

test("ignores a shared board collection that has no entry for the selected board", async () => {
  const root = await createTestTempDirectory("awa-board-config-other-");
  await fs.writeFile(path.join(root, "game-config.json"), JSON.stringify({
    boards: { twelve_player_standard: { boardSize: 12 } },
  }));
  expect(await loadBoardOverride(root, "six_player_mvp")).toBeNull();
});
