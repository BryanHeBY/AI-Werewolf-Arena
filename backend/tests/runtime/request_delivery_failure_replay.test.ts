import { expect, test, spyOn } from "bun:test";
import path from "node:path";
import { readdir } from "node:fs/promises";
import * as factory from "../../src/runtime/player_agent_factory";
import { bindRequestDeliveryGuard } from "../../src/core";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../src/runtime/config/resolve_game_setup";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { runGame } from "../../src/runtime/game_runner";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/temp_directory";

test("revoked delivery on a real engine request records an error and reproduces the exact partial cycle without a replay clock", async () => {
  const root = await createTestTempDirectory("awa-delivery-failure-"),
    output = await createTestTempDirectory("awa-delivery-failure-replay-"),
    board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../configs.example"),
      "six_player_mvp",
    ),
    runtime = parseRuntimeConfig({
      providers: {
        default: "synthetic",
        items: { synthetic: { type: "openai", apiKey: "synthetic-only" } },
      },
      agents: {
        default: "synthetic",
        items: { synthetic: { kind: "llm", provider: "synthetic", model: "synthetic" } },
      },
      game: { board: "six_player_mvp", seed: "delivery-failure", locale: "en" },
      debugSummary: { agent: { enabled: false } },
    }),
    setup = resolveGameSetup(
      runtime,
      {
        recordRootDir: root,
        maxDays: 3,
        maxRuntimeMs: 10_000,
        streamEvents: false,
        printThinking: false,
        color: false,
      },
      board,
    );
  let requests = 0;
  const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(async () => {
    let closed = false;
    return {
      kind: "llm",
      provider: {
        async getAction(request) {
          requests++;
          expect(request.context.stage).toBe("wolf_discussion");
          bindRequestDeliveryGuard(request, () => false);
          return {
            name: "speak_to_wolves",
            args: { text: "synthetic delayed delivery", end_chat: true },
          };
        },
      },
      get runtimeState() {
        return { closed };
      },
      async close() {
        closed = true;
      },
    };
  });
  try {
    await expect(runGame(setup)).rejects.toThrow("action_request_delivery_authority_revoked");
    const [session] = await readdir(root),
      record = await readReproduction(path.join(root, session!, "reproduction.json"));
    expect(requests).toBe(1);
    expect(record.termination!.reason).toBe("runtime_error");
    expect(record.decisions).toHaveLength(1);
    expect(record.decisions[0]!.outcome).toEqual({
      kind: "error",
      code: "decision_failed",
      name: "Error",
    });
    expect(record.checkpoints.at(-1)!.complete).toBe(false);
    expect(record.events.some((e) => e.type === "wolf_discussion")).toBe(false);
    const replay = await replayReproduction(record, output);
    expect(replay.decisionCount).toBe(1);
    expect(replay.eventCount).toBe(record.events.length);
  } finally {
    create.mockRestore();
  }
});
