/**
 * 单元测试以不可变公开板子／游戏示例为输入，用精确单 Bear 组合及冻结参数断言核对被动身份注册。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { Role } from "../../../src/domain";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
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
    const unregistered = structuredClone(board.definition);
    unregistered.board.roleSetups[0].role = "unregistered_role";
    expect(() => parseBoardDefinition(unregistered)).toThrow(
      "board_config_invalid_field: board.roleSetups.0.role",
    );
  });
