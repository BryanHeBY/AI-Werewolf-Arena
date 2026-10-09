import { Role } from "../../src/core";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { parseBoardDefinition } from "../../src/runtime/config/board_definition";
for (const id of ["six_player_wolf_beauty", "twelve_player_wolf_beauty"] as const)
  test(`${id}: public Beauty/Knight board accepts the named death policies and rejects arbitrary variants`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../configs.example"),
      id,
    );
    expect(board.config.roleSetups.find((row) => row.role === "wolf_beauty")).toEqual({
      role: Role.WolfBeauty,
      count: 1,
    });
    for (const params of [{ doubleTarget: true }, { selfDestruct: true }, { alwaysLinked: true }])
      expect(() =>
        parseBoardDefinition({
          ...board.definition,
          roles: { ...board.definition.roles, wolf_beauty: params },
        }),
      ).toThrow(`board_config_invalid_field: roles.wolf_beauty.${Object.keys(params)[0]}`);
    const planned = structuredClone(board.definition);
    planned.board.roleSetups[0].role = "awakened_knight";
    expect(() => parseBoardDefinition(planned)).toThrow("board_config_role_not_implemented");
  });
