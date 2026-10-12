import { expect, spyOn, test } from "bun:test";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { simulateGames } from "../../src/runtime/simulation/simulate_games";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/drivers/temp-directories";
import path from "node:path";

test("simulation and offline replay pass transient display locale to recording without changing game metadata", async () => {
  const root = await createTestTempDirectory("awa-simulation-display-");
  const output = await createTestTempDirectory("awa-replay-display-");
  const board = await loadBoardDefinition(
    path.resolve(process.cwd(), "../configs.example"),
    "six_player_mvp",
  );
  const create = SessionRecordManager.create;
  const contexts: Array<{ game?: string; display?: string }> = [];
  const spy = spyOn(SessionRecordManager, "create").mockImplementation(
    async (meta, recordRoot, displayLocale) => {
      contexts.push({ game: meta.locale, display: displayLocale });
      return create(meta, recordRoot, displayLocale);
    },
  );
  try {
    const simulated = await simulateGames(board, {
      locale: "en",
      displayLocale: "zh-CN",
      seeds: ["display-scope"],
      recordRoot: root,
    });
    const record = await readReproduction(
      path.join(simulated.games[0].recordDir, "reproduction.json"),
    );
    expect(record.metadata.locale).toBe("en");
    expect((await replayReproduction(record, output, "zh-CN")).snapshot.result).toEqual(
      simulated.games[0].result,
    );
    expect(contexts).toEqual([
      { game: "en", display: "zh-CN" },
      { game: "en", display: "zh-CN" },
    ]);
  } finally {
    spy.mockRestore();
  }
});
