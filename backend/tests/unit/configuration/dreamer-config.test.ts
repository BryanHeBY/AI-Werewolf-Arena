/**
 * Unit tests: Dreamer configuration uses immutable public examples and explicit policies;
 * exact registration and arbitrary-variant rejection checks sourced role parameters.
 * Inputs and expected outcomes remain the original literal or immutable-fixture oracle;
 * these module assertions invoke no model or complete-game driver.
 */
import { Role } from "../../../src/core";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/runtime/config/load_board_definition";
import { parseBoardDefinition } from "../../../src/runtime/config/board_definition";
for (const id of ["six_player_dreamer", "twelve_player_dreamer"] as const)
  test(`${id}: public role registration accepts the named policies and rejects arbitrary variants`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../configs.example"),
      id,
    );
    expect(board.config.roleSetups.find((row) => row.role === "dreamer")).toEqual({
      role: Role.Dreamer,
      count: 1,
    });
    for (const params of [{ poisonImmunity: false }, { optional: true }, { dayLink: true }])
      expect(() =>
        parseBoardDefinition({
          ...board.definition,
          roles: { ...board.definition.roles, dreamer: params },
        }),
      ).toThrow(`board_config_invalid_field: roles.dreamer.${Object.keys(params)[0]}`);
    const planned = structuredClone(board.definition);
    planned.board.roleSetups[0].role = "awakened_knight";
    expect(() => parseBoardDefinition(planned)).toThrow("board_config_role_not_implemented");
  });
