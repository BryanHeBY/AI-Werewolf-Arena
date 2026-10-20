/**
 * 单元测试用不可变公开示例及显式死亡政策核对 Beauty／Knight 配置；字面接受／拒绝断言验证来源参数的归一化。预期仍为既有字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { Role } from "../../../src/domain";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
for (const id of ["six_player_wolf_beauty", "twelve_player_wolf_beauty"] as const)
  test(`${id}: public Beauty/Knight board accepts the named death policies and rejects arbitrary variants`, async () => {
    const board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../../configs.example"),
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
    const unregistered = structuredClone(board.definition);
    unregistered.board.roleSetups[0].role = "unregistered_role";
    expect(() => parseBoardDefinition(unregistered)).toThrow(
      "board_config_invalid_field: board.roleSetups.0.role",
    );
  });
