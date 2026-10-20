/**
 * 单元测试以不可变公开示例为输入，用字面单身份及冻结狼队政策断言核对 Gargoyle 有限注册，不扩大规则集。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { Role } from "../../../src/domain";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
for (const id of ["six_player_gargoyle", "twelve_player_gargoyle"] as const)
  test(`${id}: public Gargoyle board allows one native role and only the frozen pack variant`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../../configs.example"),
        id,
      ),
      index = board.definition.board.roleSetups.findIndex((row) => row.role === "gargoyle");
    expect(board.definition.board.roleSetups[index]).toEqual({ role: Role.Gargoyle, count: 1 });
    for (const params of [{ chat: true }, { permanentDisguise: true }, { variant: "mist" }])
      expect(() =>
        parseBoardDefinition({
          ...board.definition,
          roles: { ...board.definition.roles, gargoyle: params },
        }),
      ).toThrow(`board_config_invalid_field: roles.gargoyle.${Object.keys(params)[0]}`);
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
        roleSetups: [...board.config.roleSetups, { role: Role.Gargoyle, count: 1 }],
      }),
    ).toThrow("role_count_exceeds_limit: gargoyle");
    const unregistered = structuredClone(board.definition);
    unregistered.board.roleSetups[0].role = "unregistered_role";
    expect(() => parseBoardDefinition(unregistered)).toThrow(
      "board_config_invalid_field: board.roleSetups.0.role",
    );
  });
