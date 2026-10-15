/**
 * 单元测试以不可变 White Wolf King 公开示例为输入，用精确激活 profile 及参数断言核对注册，不增加不支持 hook。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { Role } from "../../../src/domain";
import { expect, test } from "bun:test";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
import path from "node:path";
for (const id of ["six_player_white_wolf_king", "twelve_player_white_wolf_king"] as const)
  test(`${id}: public board activates only the real White Wolf King profile and declared parameters`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../configs.example"),
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
    unsupported.board.roleSetups[0].role = "unregistered_role";
    expect(() => parseBoardDefinition(unsupported)).toThrow(
      "board_config_invalid_field: board.roleSetups.0.role",
    );
  });
