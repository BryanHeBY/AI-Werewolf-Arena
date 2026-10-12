/**
 * Configuration IO/parser integration verify explicit config sources, agent prompts and role/seat overrides.
 * Input: Temporary provider/agent/game/board files and literal malformed settings.
 * Output and independent oracle: Original resolved values, strict field/reason limits and no fallback from present invalid overrides.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadBoardOverride } from "../../src/runtime/config/load_board_override";
import { loadRuntimeConfig } from "../../src/runtime/config/load_config";
import {
  resolveAgentProfileByName,
  resolveGameSetup,
} from "../../src/runtime/config/resolve_game_setup";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { resolveBoardConfig } from "../../src/runtime/scenarios/board_config_resolver";
import { createTestTempDirectory } from "../support/drivers/temp-directories";

async function writeRuntimeFiles(
  root: string,
  overrides: { providers?: unknown; agents?: unknown; game?: unknown; debugSummary?: unknown } = {},
): Promise<void> {
  await fs.mkdir(path.join(root, "runtime"), { recursive: true });
  await fs.mkdir(path.join(root, "games"), { recursive: true });
  await fs.writeFile(
    path.join(root, "runtime", "providers.json"),
    JSON.stringify(
      overrides.providers ?? {
        default: "test_openai",
        items: { test_openai: { type: "openai", apiKey: "test-key" } },
      },
    ),
  );
  await fs.writeFile(
    path.join(root, "runtime", "agents.json"),
    JSON.stringify(
      overrides.agents ?? {
        default: "test_agent",
        items: { test_agent: { kind: "llm", provider: "test_openai", model: "test-model" } },
      },
    ),
  );
  await fs.writeFile(
    path.join(root, "games", "strict.json"),
    JSON.stringify(overrides.game ?? { board: "six_player_mvp", agent: "test_agent" }),
  );
  if (overrides.debugSummary !== undefined)
    await fs.writeFile(
      path.join(root, "runtime", "debug_summary.json"),
      JSON.stringify(overrides.debugSummary),
    );
}

test("loads only the explicit config directory and game name", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-");
  await writeRuntimeFiles(root, {
    game: {
      board: "twelve_player_standard",
      agent: "test_agent",
      playerAgents: { "1": "test_agent" },
    },
  });
  const runtime = await loadRuntimeConfig({ configDir: root, gameName: "strict" });
  expect(runtime.providers.default).toBe("test_openai");
  expect(runtime.game.board).toBe("twelve_player_standard");
});

for (const kind of ["llm", "acp"] as const) {
  test(`${kind} preserves agent prompts and supports role/seat prompt overrides`, () => {
    const runtime = parseRuntimeConfig({
      providers: {
        default: "test_provider",
        items: {
          test_provider:
            kind === "llm"
              ? { type: "openai", apiKey: "test-key" }
              : { type: "acp", transport: "stdio", command: "test-acp" },
        },
      },
      agents: {
        default: "test_agent",
        items: {
          test_agent: {
            kind,
            provider: "test_provider",
            personalityPrompt: "默认风格",
            ...(kind === "llm" ? { model: "test-model" } : { spawnArgs: ["--base"] }),
          },
        },
      },
      game: {
        agent: "test_agent",
        roleAgents: { wolf: { agent: "test_agent", personalityPrompt: "狼人风格" } },
        playerAgents: {
          "1": {
            agent: "test_agent",
            personalityPrompt: "一号风格",
            ...(kind === "acp" ? { spawnArgs: ["--seat"] } : {}),
          },
          "2": "test_agent",
          "3": { agent: "test_agent" },
        },
      },
    });
    const setup = resolveGameSetup(runtime);
    expect(setup.defaultProfile.personalityPrompt).toBe("默认风格");
    expect(setup.roleProfiles.wolf.personalityPrompt).toBe("狼人风格");
    expect(setup.playerProfiles["1"].personalityPrompt).toBe("一号风格");
    expect(setup.playerProfiles["2"].personalityPrompt).toBe("默认风格");
    expect(setup.playerProfiles["3"].personalityPrompt).toBe("默认风格");
    expect(resolveAgentProfileByName(runtime).personalityPrompt).toBe("默认风格");
    if (kind === "acp") expect(setup.playerProfiles["1"].spawnArgs).toEqual(["--base", "--seat"]);
  });
}

test("validates ACP prompt strings at agent and selection boundaries", () => {
  const input = {
    providers: {
      default: "acp",
      items: { acp: { type: "acp", transport: "stdio", command: "test-acp" } },
    },
    agents: { default: "acp", items: { acp: { kind: "acp", provider: "acp" } } },
    game: { agent: "acp" },
  };
  expect(() =>
    parseRuntimeConfig({
      ...input,
      agents: {
        ...input.agents,
        items: { acp: { ...input.agents.items.acp, personalityPrompt: 123 } },
      },
    }),
  ).toThrow("runtime_config_required_string_invalid: agents.items.acp.personalityPrompt");
  expect(() =>
    parseRuntimeConfig({
      ...input,
      game: {
        ...input.game,
        playerAgents: { "1": { agent: "acp", personalityPrompt: " " } },
      },
    }),
  ).toThrow("runtime_config_required_string_invalid: game.playerAgents.1.personalityPrompt");
});

test("rejects legacy provider and agent shapes", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-legacy-");
  await writeRuntimeFiles(root, {
    providers: { type: "openai", apiKey: "test-key" },
    agents: { default: { model: "test-model" } },
  });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow(
    "runtime_config_unknown_field: providers.type",
  );
});

test("rejects inline audit model overrides", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-debug-");
  await writeRuntimeFiles(root, {
    debugSummary: { agent: { profile: { model: "different-model" } } },
  });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow(
    "runtime_config_unknown_field: debugSummary.agent.profile",
  );
});

test("requires an explicit reasoning effort and rejects removed AI flags", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-reasoning-");
  await writeRuntimeFiles(root, {
    agents: {
      default: "test_agent",
      items: { test_agent: { kind: "llm", provider: "test_openai", model: "test-model" } },
    },
  });
  const runtime = await loadRuntimeConfig({ configDir: root, gameName: "strict" });
  expect(resolveAgentProfileByName(runtime).reasoningEffort).toBeUndefined();

  await writeRuntimeFiles(root, {
    agents: {
      default: "test_agent",
      items: {
        test_agent: {
          kind: "llm",
          provider: "test_openai",
          model: "test-model",
          reasoningEffort: "xhigh",
        },
      },
    },
  });
  expect(
    resolveAgentProfileByName(await loadRuntimeConfig({ configDir: root, gameName: "strict" }))
      .reasoningEffort,
  ).toBe("xhigh");

  await writeRuntimeFiles(root, {
    agents: {
      default: "test_agent",
      items: {
        test_agent: {
          kind: "llm",
          provider: "test_openai",
          model: "test-model",
          forceJsonResponse: true,
        },
      },
    },
  });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow(
    "runtime_config_unknown_field: agents.items.test_agent.forceJsonResponse",
  );

  await writeRuntimeFiles(root, {
    agents: {
      default: "test_agent",
      items: {
        test_agent: {
          kind: "llm",
          provider: "test_openai",
          model: "test-model",
          reasoningEnabled: true,
        },
      },
    },
  });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow(
    "runtime_config_unknown_field: agents.items.test_agent.reasoningEnabled",
  );
});

test("rejects invalid AI limits and Anthropic thinking with temperature", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-ai-limits-");
  await writeRuntimeFiles(root, {
    agents: {
      default: "test_agent",
      items: {
        test_agent: { kind: "llm", provider: "test_openai", model: "test-model", maxTokens: 0 },
      },
    },
  });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow(
    "runtime_config_positive_integer_invalid: agents.items.test_agent.maxTokens",
  );

  await writeRuntimeFiles(root, {
    providers: {
      default: "test_openai",
      items: { test_openai: { type: "openai", apiKey: "test-key", maxConcurrentRequests: 1.5 } },
    },
  });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow(
    "runtime_config_positive_integer_invalid: providers.items.test_openai.maxConcurrentRequests",
  );

  await writeRuntimeFiles(root, {
    providers: { default: "claude", items: { claude: { type: "anthropic", apiKey: "test-key" } } },
    agents: {
      default: "test_agent",
      items: {
        test_agent: {
          kind: "llm",
          provider: "claude",
          model: "claude-test",
          thinkingEnabled: true,
          temperature: 0.2,
        },
      },
    },
  });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow(
    "runtime_config_anthropic_thinking_temperature_unsupported: test_agent",
  );

  await writeRuntimeFiles(root, {
    providers: { default: "claude", items: { claude: { type: "anthropic", apiKey: "test-key" } } },
    agents: {
      default: "test_agent",
      items: {
        test_agent: {
          kind: "llm",
          provider: "claude",
          model: "claude-test",
          reasoningEffort: "xhigh",
        },
      },
    },
  });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow(
    "runtime_config_anthropic_reasoning_effort_invalid: test_agent",
  );
});

test("rejects zero game deadlines and audit limits below their effective minimum", async () => {
  const root = await createTestTempDirectory("awa-runtime-config-limits-");
  await writeRuntimeFiles(root, { game: { board: "six_player_mvp", llmTimeoutMs: 0 } });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow(
    "runtime_config_positive_integer_invalid: game.llmTimeoutMs",
  );

  await writeRuntimeFiles(root, { debugSummary: { agent: { maxAttempts: 0 } } });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow(
    "runtime_config_positive_integer_invalid: debugSummary.agent.maxAttempts",
  );

  await writeRuntimeFiles(root, { debugSummary: { agent: { publicMaxItems: 59 } } });
  await expect(loadRuntimeConfig({ configDir: root, gameName: "strict" })).rejects.toThrow(
    "runtime_config_minimum_integer_invalid: debugSummary.agent.publicMaxItems >= 60",
  );
});

test("loads a board override before pure board resolution", async () => {
  const root = await createTestTempDirectory("awa-board-config-");
  await fs.mkdir(path.join(root, "boards"));
  await fs.writeFile(
    path.join(root, "boards", "six_player_mvp.json"),
    JSON.stringify({
      mechanisms: { sheriff: { enabled: true } },
    }),
  );

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
  await expect(loadBoardOverride(root, "six_player_mvp")).rejects.toThrow(
    "board_config_invalid_override",
  );
  await fs.writeFile(file, JSON.stringify({ mechanisms: { sheriff: { enabled: "yes" } } }));
  await expect(loadBoardOverride(root, "six_player_mvp")).rejects.toThrow(
    "board_config_invalid_override_field: mechanisms.sheriff.enabled",
  );
  await fs.writeFile(file, "{ invalid json");
  await expect(loadBoardOverride(root, "six_player_mvp")).rejects.toThrow(
    "board_config_json_invalid",
  );
});

test("ignores a shared board collection that has no entry for the selected board", async () => {
  const root = await createTestTempDirectory("awa-board-config-other-");
  await fs.writeFile(
    path.join(root, "game-config.json"),
    JSON.stringify({
      boards: { twelve_player_standard: { boardSize: 12 } },
    }),
  );
  expect(await loadBoardOverride(root, "six_player_mvp")).toBeNull();
});
