/**
 * Reproduction scenarios verify transient display locale is passed to recording without replacing game metadata locale.
 * Input: The original recorder-creation spy, actual simulation and subsequent offline reproduction.
 * Output and oracle: Explicit display-versus-game locale assertions cover both executions; dictionary contents and archived metadata are not changed.
 */
import { expect, spyOn, test } from "bun:test";
import { SessionRecordManager } from "../../../../src/recording/session/recorder";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { simulateGames } from "../../../../src/app/simulation/simulate-games";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
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
