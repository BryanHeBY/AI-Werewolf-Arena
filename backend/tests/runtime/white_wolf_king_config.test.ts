import { Role } from "../../src/core";
import { expect, test } from "bun:test";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { parseBoardDefinition } from "../../src/runtime/config/board_definition";
import path from "node:path";
for (const id of ["six_player_white_wolf_king", "twelve_player_white_wolf_king"] as const)
  test(`${id}: public board activates only the real White Wolf King profile and declared parameters`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../configs.example"),
      id,
    );
    expect(board.config.roleSetups.find((entry) => entry.role === "white_wolf_king")).toEqual({
      role: Role.WhiteWolfKing,
      count: 1,
    });
    expect(() =>
      parseBoardDefinition({
        ...board.definition,
        roles: { ...board.definition.roles, white_wolf_king: { swallowPoison: true } },
      }),
    ).toThrow("board_config_role_parameters_not_supported");
    const unsupported = structuredClone(board.definition);
    unsupported.board.roleSetups[0].role = "awakened_knight";
    expect(() => parseBoardDefinition(unsupported)).toThrow("board_config_role_not_implemented");
  });
