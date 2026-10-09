import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../src/app/bootstrap";
import { Role, type BoardConfig } from "../../src/core";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { boardDefinitionFromConfig, parseBoardDefinition } from "../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";

for (const size of ["six", "twelve"] as const) test(`${size}: example Awakened configuration loads strict role parameters and the declared composition`, async () => {
  const id = `${size}_player_awakened_hidden_wolf`, root = path.resolve(import.meta.dir, "../../../configs.example"), board = await loadBoardDefinition(root, id);
  expect(board.config.boardSize).toBe(size === "six" ? 6 : 12); expect(board.definition.roles.awakened_hidden_wolf).toEqual({});
  expect(JSON.parse(await readFile(path.join(root, "games", `${id}.json`), "utf8")).board).toBe(id); expect(() => bootstrapGame(board.config)).not.toThrow();
  const counts = Object.fromEntries(board.config.roleSetups.map(row => [row.role, row.count]));
  expect(counts).toEqual(size === "twelve" ? { awakened_hidden_wolf: 1, wolf: 3, mirror_girl: 1, witch: 1, hunter: 1, guard: 1, villager: 4 } : { awakened_hidden_wolf: 1, wolf: 1, mirror_girl: 1, witch: 1, villager: 2 });
  for (const params of [{ mode: true }, { stage: 250 }, { reflectPoison: true }, { expiresOnFirstKnife: true }, { mimicRoles: ["seer"] }]) {
    const raw = structuredClone(board.definition); raw.roles.awakened_hidden_wolf = params;
    expect(() => parseBoardDefinition(raw)).toThrow("board_config_invalid_field");
  }
});
for (const extra of [Role.Seer, Role.HiddenWolf, Role.Gargoyle, Role.Psychic, Role.MechanicalWolf, Role.MiracleMerchant, Role.Hybrid, Role.Dreamer, Role.WolfBeauty, Role.WolfKing, Role.WhiteWolfKing, Role.Idiot]) test(`${extra}: both board entrypoints reject undeclared Aw joint rules`, () => {
  const config: BoardConfig = { ...sixPlayerMvpConfig, roleSetups: [{ role: Role.AwakenedHiddenWolf, count: 1 }, { role: Role.Wolf, count: 1 }, { role: extra, count: 1 }, { role: Role.Villager, count: 3 }] };
  expect(() => bootstrapGame(config)).toThrow("role_combination_not_supported"); expect(() => parseBoardDefinition(boardDefinitionFromConfig("aw_invalid", config))).toThrow("board_config_role_combination_not_supported");
});
test("Awakened native count is at most one through parse and direct bootstrap", () => {
  const config: BoardConfig = { ...sixPlayerMvpConfig, roleSetups: [{ role: Role.AwakenedHiddenWolf, count: 2 }, { role: Role.Wolf, count: 1 }, { role: Role.Villager, count: 3 }] };
  expect(() => bootstrapGame(config)).toThrow("role_count_exceeds_limit"); expect(() => parseBoardDefinition(boardDefinitionFromConfig("aw_duplicate", config))).toThrow("board_config_invalid_field");
});
