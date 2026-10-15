/**
 * Configuration filesystem integration tests verify public Mechanical Wolf examples resolve their declared finite role set.
 * Input: Original six/twelve-player board/game JSON and four literal invented role parameter objects.
 * Output and oracle: Exact board size, native count, empty public parameters and strict parameter refusals retain file-loader wiring; original JSON bytes are read unchanged.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { Role } from "../../../../src/domain";

for (const id of ["six_player_mechanical_wolf", "twelve_player_mechanical_wolf"])
  test(`${id}: public board and game examples load with the complete finite learning role set`, async () => {
    const root = path.resolve(import.meta.dir, "../../../../../configs.example"),
      board = await loadBoardDefinition(root, id);
    expect(board.config.boardSize).toBe(id.startsWith("six") ? 6 : 12);
    expect(board.config.roleSetups.find((s) => s.role === Role.MechanicalWolf)?.count).toBe(1);
    expect(board.definition.roles.mechanical_wolf).toEqual({});
    expect(JSON.parse(await readFile(path.join(root, "games", `${id}.json`), "utf8")).board).toBe(
      id,
    );
    expect(() => bootstrapGame(board.config)).not.toThrow();
    for (const value of [
      { skill: "guard" },
      { mode: "kill" },
      { recognizePack: true },
      { arbitrary: 1 },
    ]) {
      const invalid = structuredClone(board.definition);
      invalid.roles.mechanical_wolf = value;
      expect(() => parseBoardDefinition(invalid)).toThrow("board_config_invalid_field");
    }
  });
