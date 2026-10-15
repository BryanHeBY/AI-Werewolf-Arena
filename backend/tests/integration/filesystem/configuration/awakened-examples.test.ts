/**
 * Configuration filesystem integration tests verify public Awakened examples load declared role composition and reject invented parameters.
 * Input: Original six/twelve-player public board/game JSON files and literal role-parameter alterations.
 * Output and oracle: Exact composition, strict parameter errors and successful initialization retain file-to-configuration wiring; source files are read without model or game execution.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";

for (const size of ["six", "twelve"] as const)
  test(`${size}: example Awakened configuration loads strict role parameters and the declared composition`, async () => {
    const id = `${size}_player_awakened_hidden_wolf`,
      root = path.resolve(import.meta.dir, "../../../../../configs.example"),
      board = await loadBoardDefinition(root, id);
    expect(board.config.boardSize).toBe(size === "six" ? 6 : 12);
    expect(board.definition.roles.awakened_hidden_wolf).toEqual({});
    expect(JSON.parse(await readFile(path.join(root, "games", `${id}.json`), "utf8")).board).toBe(
      id,
    );
    expect(() => bootstrapGame(board.config)).not.toThrow();
    const counts = Object.fromEntries(board.config.roleSetups.map((row) => [row.role, row.count]));
    expect(counts).toEqual(
      size === "twelve"
        ? {
            awakened_hidden_wolf: 1,
            wolf: 3,
            mirror_girl: 1,
            witch: 1,
            hunter: 1,
            guard: 1,
            villager: 4,
          }
        : { awakened_hidden_wolf: 1, wolf: 1, mirror_girl: 1, witch: 1, villager: 2 },
    );
    for (const params of [
      { mode: true },
      { stage: 250 },
      { reflectPoison: true },
      { expiresOnFirstKnife: true },
      { mimicRoles: ["seer"] },
    ]) {
      const raw = structuredClone(board.definition);
      raw.roles.awakened_hidden_wolf = params;
      expect(() => parseBoardDefinition(raw)).toThrow("board_config_invalid_field");
    }
  });
