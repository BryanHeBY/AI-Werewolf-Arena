import { expect, spyOn, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { bootstrapGame } from "../../src/app/bootstrap";
import { createRandom, RANDOM_ALGORITHM, RANDOM_STREAM_POLICY } from "../../src/core";
import { BaselineBotActionProvider } from "../../src/ai/agents/providers/action_providers";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../src/runtime/config/resolve_game_setup";
import { runGame } from "../../src/runtime/game_runner";
import * as factory from "../../src/runtime/player_agent_factory";
import { createTestTempDirectory } from "../support/drivers/temp-directories";

for (const seed of ["recorded-seed", undefined]) {
  test(`runner saves ${seed ? "configured" : "generated"} seed and reproduces the deal without publishing RNG metadata`, async () => {
    const root = await createTestTempDirectory("awa-runner-random-");
    const runtime = parseRuntimeConfig({
      providers: {
        default: "unused",
        items: { unused: { type: "openai", apiKey: "PRIVATE_AUTH_VALUE" } },
      },
      agents: {
        default: "unused",
        items: { unused: { kind: "llm", provider: "unused", model: "unused" } },
      },
      game: { ...(seed ? { seed } : {}), players: { "1": { name: "Player One" } } },
      debugSummary: { agent: { enabled: false } },
    });
    const setup = resolveGameSetup(runtime, {
      recordRootDir: root,
      maxDays: 30,
      streamEvents: false,
      color: false,
    });
    let closed = 0;
    const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(
      async (options) => ({
        kind: "llm",
        runtimeState: { closed: false },
        provider: new BaselineBotActionProvider(options.world),
        async close() {
          closed++;
        },
      }),
    );
    try {
      const result = await runGame(setup);
      expect(result.snapshot.gameOver).toBe(true);
      expect(closed).toBe(1);
      const [session] = await readdir(root);
      const manifest = JSON.parse(
        await readFile(path.join(root, session, "manifest.json"), "utf8"),
      );
      expect(manifest.random.algorithm).toBe(RANDOM_ALGORITHM);
      expect(manifest.random.streamPolicy).toBe(RANDOM_STREAM_POLICY);
      expect(manifest.random.path).toEqual([]);
      if (seed) expect(manifest.random.seed).toBe(seed);
      else expect(manifest.random.seed).toMatch(/^[a-f0-9-]{36}$/);
      expect(manifest.players[0].name).toBe("Player One");
      const replay = JSON.parse(await readFile(path.join(root, session, "replay.json"), "utf8"));
      const recreated = bootstrapGame(setup.boardConfig, {
        random: createRandom(manifest.random.seed),
        playerNames: { "1": "Player One" },
      });
      expect(replay.events[0].payload).toEqual(recreated.phaseManager.getEvents()[0].payload);
      expect(replay.players[0].name).toBe("Player One");
      expect(manifest.locale).toBe("zh-CN");
      expect(replay.meta.locale).toBe("zh-CN");
      expect(replay.schemaVersion).toBe(2);
      expect(replay.random).toBeUndefined();
      expect(replay.meta.random).toBeUndefined();
      expect(JSON.stringify(manifest)).not.toContain("PRIVATE_AUTH_VALUE");
      expect(JSON.stringify(replay)).not.toContain("PRIVATE_AUTH_VALUE");
    } finally {
      create.mockRestore();
    }
  });
}
