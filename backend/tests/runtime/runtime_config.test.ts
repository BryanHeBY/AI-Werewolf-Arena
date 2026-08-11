import { afterEach, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  clearRuntimeConfigCache,
  loadRuntimeConfig,
  setRuntimeConfigOverride,
} from "../../src/runtime/config/runtime_config";
import { createTestTempDirectory } from "../support/temp_directory";

const initialConfigsDir = process.env.GAME_CONFIGS_DIR;
const initialGameName = process.env.GAME_CONFIG_NAME;

afterEach(() => {
  setRuntimeConfigOverride(null);
  clearRuntimeConfigCache();
  if (initialConfigsDir === undefined) delete process.env.GAME_CONFIGS_DIR;
  else process.env.GAME_CONFIGS_DIR = initialConfigsDir;
  if (initialGameName === undefined) delete process.env.GAME_CONFIG_NAME;
  else process.env.GAME_CONFIG_NAME = initialGameName;
});

async function writeRuntimeFiles(root: string, overrides: {
  providers?: unknown;
  agents?: unknown;
  game?: unknown;
  debugSummary?: unknown;
} = {}): Promise<void> {
  await fs.mkdir(path.join(root, "runtime"), { recursive: true });
  await fs.mkdir(path.join(root, "games"), { recursive: true });
  await fs.writeFile(path.join(root, "runtime", "providers.json"), JSON.stringify(
    overrides.providers ?? {
      default: "test_openai",
      items: { test_openai: { type: "openai", apiKey: "test-key" } },
    },
  ));
  await fs.writeFile(path.join(root, "runtime", "agents.json"), JSON.stringify(
    overrides.agents ?? {
      default: "test_agent",
      items: { test_agent: { kind: "llm", provider: "test_openai", model: "test-model" } },
    },
  ));
  await fs.writeFile(path.join(root, "games", "strict.json"), JSON.stringify(
    overrides.game ?? { board: "six_player_mvp", agent: "test_agent" },
  ));
  if (overrides.debugSummary !== undefined) {
    await fs.writeFile(
      path.join(root, "runtime", "debug_summary.json"),
      JSON.stringify(overrides.debugSummary),
    );
  }
}

test("loads only the explicit providers, agents, and named game files", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-");
  await writeRuntimeFiles(root, {
    game: {
      board: "twelve_player_standard",
      agent: "test_agent",
      playerAgents: { "1": "test_agent" },
    },
  });
  process.env.GAME_CONFIGS_DIR = root;
  process.env.GAME_CONFIG_NAME = "strict";

  const runtime = await loadRuntimeConfig();

  expect(runtime.providers.default).toBe("test_openai");
  expect(runtime.agents.items.test_agent.kind).toBe("llm");
  expect(runtime.game.board).toBe("twelve_player_standard");
  expect(runtime.game.playerAgents?.["1"]).toBe("test_agent");
});

test("rejects legacy provider and agent shapes instead of inferring defaults", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-legacy-");
  await writeRuntimeFiles(root, {
    providers: { type: "openai", apiKey: "test-key" },
    agents: { default: { model: "test-model" } },
  });
  process.env.GAME_CONFIGS_DIR = root;
  process.env.GAME_CONFIG_NAME = "strict";

  await expect(loadRuntimeConfig()).rejects.toThrow("runtime_config_unknown_field: providers.type");
});

test("rejects inline audit model overrides", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-debug-");
  await writeRuntimeFiles(root, {
    debugSummary: { agent: { profile: { model: "different-model" } } },
  });
  process.env.GAME_CONFIGS_DIR = root;
  process.env.GAME_CONFIG_NAME = "strict";

  await expect(loadRuntimeConfig()).rejects.toThrow(
    "runtime_config_unknown_field: debugSummary.agent.profile",
  );
});
