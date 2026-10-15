/**
 * Configuration filesystem integration tests verify public Miracle Merchant examples reject arbitrary role parameters.
 * Input: Original six/twelve-player board/game files and four literal parameter alterations.
 * Output and oracle: Exact board identity, empty role parameters and unchanged strict rejections retain source-file wiring; no fixture generation or model is involved.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";

for (const id of ["six_player_miracle_merchant", "twelve_player_miracle_merchant"])
  test(`${id}: finite examples load without arbitrary policies and direct bootstrap applies the same count/combination rules`, async () => {
    const root = path.resolve(import.meta.dir, "../../../../../configs.example"),
      board = await loadBoardDefinition(root, id);
    expect(board.config.boardSize).toBe(id.startsWith("six") ? 6 : 12);
    expect(board.definition.roles.miracle_merchant).toEqual({});
    expect(JSON.parse(await readFile(path.join(root, "games", `${id}.json`), "utf8")).board).toBe(
      id,
    );
    expect(() => bootstrapGame(board.config)).not.toThrow();
    for (const params of [
      { remaining: 2 },
      { instant: false },
      { backlash: false },
      { sourceDisclosed: true },
    ]) {
      const invalid = structuredClone(board.definition);
      invalid.roles.miracle_merchant = params;
      expect(() => parseBoardDefinition(invalid)).toThrow("board_config_invalid_field");
    }
  });
