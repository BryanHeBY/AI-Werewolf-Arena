/**
 * Unit tests: Psychic configuration uses immutable public examples; exact single-role and
 * frozen-inspection assertions check finite registration and invalid variants. Inputs and
 * expected outcomes remain the original literal or immutable-fixture oracle; these module
 * assertions invoke no model or complete-game driver.
 */
import { Role } from "../../../src/core";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/runtime/config/load_board_definition";
import { parseBoardDefinition } from "../../../src/runtime/config/board_definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
for (const id of ["six_player_psychic", "twelve_player_psychic"] as const)
  test(`${id}: public Psychic board allows one native role and only the frozen inspection variant`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../configs.example"),
        id,
      ),
      index = board.definition.board.roleSetups.findIndex((row) => row.role === "psychic");
    expect(board.definition.board.roleSetups[index]).toEqual({ role: Role.Psychic, count: 1 });
    for (const params of [{ chat: true }, { permanentDisguise: true }, { variant: "mist" }])
      expect(() =>
        parseBoardDefinition({
          ...board.definition,
          roles: { ...board.definition.roles, psychic: params },
        }),
      ).toThrow(`board_config_invalid_field: roles.psychic.${Object.keys(params)[0]}`);
    const doubled = structuredClone(board.definition);
    doubled.board.size++;
    doubled.board.roleSetups[index].count++;
    expect(() => parseBoardDefinition(doubled)).toThrow(
      `board_config_invalid_field: board.roleSetups.${index}.count`,
    );
    expect(() =>
      bootstrapGame({
        ...board.config,
        boardSize: board.config.boardSize + 1,
        roleSetups: [...board.config.roleSetups, { role: Role.Psychic, count: 1 }],
      }),
    ).toThrow("role_count_exceeds_limit: psychic");
    const planned = structuredClone(board.definition);
    planned.board.roleSetups[0].role = "awakened_knight";
    expect(() => parseBoardDefinition(planned)).toThrow("board_config_role_not_implemented");
  });
