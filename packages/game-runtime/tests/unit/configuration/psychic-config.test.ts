/**
 * 单元测试用不可变公开示例核对 Psychic 配置；精确单身份及冻结查验断言验证有限注册与非法变体。预期仍为既有字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { Role } from "../../../src/domain";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
for (const id of ["six_player_psychic", "twelve_player_psychic"] as const)
  test(`${id}: public Psychic board allows one native role and only the frozen inspection variant`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../../configs.example"),
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
    const unregistered = structuredClone(board.definition);
    unregistered.board.roleSetups[0].role = "unregistered_role";
    expect(() => parseBoardDefinition(unregistered)).toThrow(
      "board_config_invalid_field: board.roleSetups.0.role",
    );
  });
