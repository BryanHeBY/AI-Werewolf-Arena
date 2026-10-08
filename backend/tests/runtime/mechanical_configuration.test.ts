import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../src/app/bootstrap";
import { parseBoardDefinition, boardDefinitionFromConfig } from "../../src/runtime/config/board_definition";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { Role, type BoardConfig } from "../../src/core";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { configDiagnostic } from "../../src/runtime/config/error_codes";

for (const id of ["six_player_mechanical_wolf", "twelve_player_mechanical_wolf"]) test(`${id}: public board and game examples load with the complete finite learning role set`, async () => {
  const root = path.resolve(import.meta.dir, "../../../configs.example"), board = await loadBoardDefinition(root, id);
  expect(board.config.boardSize).toBe(id.startsWith("six") ? 6 : 12);
  expect(board.config.roleSetups.find(s => s.role === Role.MechanicalWolf)?.count).toBe(1);
  expect(board.definition.roles.mechanical_wolf).toEqual({});
  expect(JSON.parse(await readFile(path.join(root, "games", `${id}.json`), "utf8")).board).toBe(id);
  expect(() => bootstrapGame(board.config)).not.toThrow();
  for (const value of [{ skill: "guard" }, { mode: "kill" }, { recognizePack: true }, { arbitrary: 1 }]) {
    const invalid = structuredClone(board.definition); invalid.roles.mechanical_wolf = value;
    expect(() => parseBoardDefinition(invalid)).toThrow("board_config_invalid_field");
  }
});

for (const unsupported of Object.values(Role).filter(role => ![Role.Wolf,Role.Psychic,Role.Witch,Role.Hunter,Role.Guard,Role.Villager,Role.MechanicalWolf].includes(role))) test(`${unsupported}: parse and direct bootstrap reject a board outside mechanical learning scope before play`, () => {
  const config: BoardConfig = { ...sixPlayerMvpConfig, roleSetups: [{ role: Role.MechanicalWolf, count: 1 }, { role: Role.Wolf, count: 1 }, { role: unsupported, count: 1 }, { role: Role.Villager, count: 3 }] };
  expect(() => parseBoardDefinition(boardDefinitionFromConfig("mechanical_unsupported", config))).toThrow("board_config_role_combination_not_supported");
  expect(() => bootstrapGame(config)).toThrow("role_combination_not_supported");
  try { parseBoardDefinition(boardDefinitionFromConfig("mechanical_unsupported", config)); throw new Error("expected unsupported board"); }
  catch (error) { expect(configDiagnostic(error)).toEqual({ code: "board_config_role_combination_not_supported", path: "board.roleSetups" }); }
});

test("both entrypoints enforce one native mechanical wolf", () => {
  const config: BoardConfig = { ...sixPlayerMvpConfig, roleSetups: [{ role: Role.MechanicalWolf, count: 2 }, { role: Role.Witch, count: 1 }, { role: Role.Villager, count: 3 }] };
  expect(() => parseBoardDefinition(boardDefinitionFromConfig("mechanical_duplicate", config))).toThrow("board_config_invalid_field");
  expect(() => bootstrapGame(config)).toThrow("role_count_exceeds_limit");
});
