/**
 * 单元测试用不可变公开示例核对 Hidden Wolf 配置；字面原生数量及冻结狼队变体断言验证声明的身份契约。预期仍为既有字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { Role } from "../../../src/domain";
import { expect, test } from "bun:test";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
for (const id of ["six_player_hidden_wolf", "twelve_player_hidden_wolf"] as const)
  test(`${id}: public Hidden Wolf board allows one native role and only the frozen pack variant`, async () => {
    const board = await loadBoardDefinition(
        path.resolve(import.meta.dir, "../../../../configs.example"),
        id,
      ),
      index = board.definition.board.roleSetups.findIndex((row) => row.role === "hidden_wolf");
    expect(board.definition.board.roleSetups[index]).toEqual({ role: Role.HiddenWolf, count: 1 });
    for (const params of [{ chat: true }, { permanentDisguise: true }, { variant: "mist" }])
      expect(() =>
        parseBoardDefinition({
          ...board.definition,
          roles: { ...board.definition.roles, hidden_wolf: params },
        }),
      ).toThrow(`board_config_invalid_field: roles.hidden_wolf.${Object.keys(params)[0]}`);
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
        roleSetups: [...board.config.roleSetups, { role: Role.HiddenWolf, count: 1 }],
      }),
    ).toThrow("role_count_exceeds_limit: hidden_wolf");
    const planned = structuredClone(board.definition);
    planned.board.roleSetups[0].role = "awakened_knight";
    expect(() => parseBoardDefinition(planned)).toThrow("board_config_role_not_implemented");
  });
