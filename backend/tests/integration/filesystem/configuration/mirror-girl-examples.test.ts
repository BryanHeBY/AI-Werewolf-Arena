/**
 * Configuration filesystem integration tests verify public Mirror Girl examples retain the finite inspection policy.
 * Input: Original six/twelve-player board/game JSON and four literal invented policy parameter objects.
 * Output and oracle: Exact machine policy identity and strict parameter refusals preserve loader behavior; archive/example bytes and role rules are unchanged.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";

for (const id of ["six_player_mirror_girl", "twelve_player_mirror_girl"])
  test(`${id}: finite examples load without arbitrary policies and direct bootstrap applies the same count/combination rules`, async () => {
    const root = path.resolve(import.meta.dir, "../../../../../configs.example"),
      board = await loadBoardDefinition(root, id);
    expect(board.config.boardSize).toBe(id.startsWith("six") ? 6 : 12);
    expect(board.definition.roles.mirror_girl).toEqual({
      inspectionPolicy: "awa_unique_optional_v1",
    });
    expect(JSON.parse(await readFile(path.join(root, "games", `${id}.json`), "utf8")).board).toBe(
      id,
    );
    expect(() => bootstrapGame(board.config)).not.toThrow();
    for (const params of [{ repeat: true }, { allowSelf: true }, { stage: 180 }, { maxUses: 2 }]) {
      const invalid = structuredClone(board.definition);
      invalid.roles.mirror_girl = params;
      expect(() => parseBoardDefinition(invalid)).toThrow("board_config_invalid_field");
    }
  });
