/**
 * 单元测试用不可变公开示例和显式政策核对 Dreamer 配置；精确注册及任意变体拒绝用于验证声明的身份参数。预期仍为既有字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { Role } from "../../../src/domain";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
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
    const unregistered = structuredClone(board.definition);
    unregistered.board.roleSetups[0].role = "unregistered_role";
    expect(() => parseBoardDefinition(unregistered)).toThrow(
      "board_config_invalid_field: board.roleSetups.0.role",
    );
  });
