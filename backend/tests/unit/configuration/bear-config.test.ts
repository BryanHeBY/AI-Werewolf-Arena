/**
 * Unit tests: Bear configuration uses immutable public board/game examples; exact
 * single-Bear composition and frozen parameter assertions check passive role registration.
 * Inputs and expected outcomes remain the original literal or immutable-fixture oracle;
 * these module assertions invoke no model or complete-game driver.
 */
import { Role } from "../../../src/core";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/runtime/config/load_board_definition";
import { parseBoardDefinition } from "../../../src/runtime/config/board_definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
for (const id of ["six_player_bear", "twelve_player_bear"] as const)
  test(`${id}: public Bear board enforces a single native Bear and only frozen empty parameters`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../configs.example"),
        id,
      ),
      index = board.definition.board.roleSetups.findIndex((row) => row.role === "bear");
    expect(board.definition.board.roleSetups[index]).toEqual({ role: Role.Bear, count: 1 });
    for (const params of [{ sampleAt: "dawn" }, { revealId: true }, { active: true }])
      expect(() =>
        parseBoardDefinition({
          ...board.definition,
          roles: { ...board.definition.roles, bear: params },
        }),
      ).toThrow(`board_config_invalid_field: roles.bear.${Object.keys(params)[0]}`);
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
        roleSetups: [...board.config.roleSetups, { role: Role.Bear, count: 1 }],
      }),
    ).toThrow("role_count_exceeds_limit: bear");
    const planned = structuredClone(board.definition);
    planned.board.roleSetups[0].role = "awakened_knight";
    expect(() => parseBoardDefinition(planned)).toThrow("board_config_role_not_implemented");
  });
