/**
 * Configuration filesystem integration tests verify public Hybrid examples resolve finite role composition without arbitrary policy parameters.
 * Input: Original six/twelve-player public board/game files and four literal invented parameter objects.
 * Output and oracle: Exact counts/board identity and strict parameter rejection preserve file-loader wiring; existing example bytes and initialization behavior are unchanged.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../../src/runtime/config/board_definition";
import { loadBoardDefinition } from "../../../../src/runtime/config/load_board_definition";

for (const id of ["six_player_hybrid", "twelve_player_hybrid"])
  test(`${id}: finite examples load without arbitrary policies and direct bootstrap applies the same count/combination rules`, async () => {
    const root = path.resolve(import.meta.dir, "../../../../../configs.example"),
      board = await loadBoardDefinition(root, id);
    expect(board.config.boardSize).toBe(id.startsWith("six") ? 6 : 12);
    expect(board.definition.roles.hybrid).toEqual({});
    expect(JSON.parse(await readFile(path.join(root, "games", `${id}.json`), "utf8")).board).toBe(
      id,
    );
    expect(() => bootstrapGame(board.config)).not.toThrow();
    for (const params of [
      { remaining: 2 },
      { reselect: true },
      { recognition: true },
      { followCurrentCamp: true },
    ]) {
      const invalid = structuredClone(board.definition);
      invalid.roles.hybrid = params;
      expect(() => parseBoardDefinition(invalid)).toThrow("board_config_invalid_field");
    }
  });
