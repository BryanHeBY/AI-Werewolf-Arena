/**
 * 配置文件系统集成测试读取原公开六／十二人魔镜少女板子与游戏 JSON，并提供四个手写虚构政策参数对象，核对有限查验政策。精确机器政策身份及严格参数拒绝为预期；不改档案／示例字节或身份规则。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";

for (const id of ["six_player_mirror_girl", "twelve_player_mirror_girl"])
  test(`${id}: finite examples load without arbitrary policies and direct bootstrap applies the same count/combination rules`, async () => {
    const root = path.resolve(import.meta.dir, "../../../../../configs.example"),
      board = await loadBoardDefinition(root, id);
    expect(board.config.boardSize).toBe(id.startsWith("six") ? 6 : 12);
    expect(board.definition.roles.mirror_girl).toEqual({
      inspectionPolicy: "awa_unique_optional_v1",
    });
    expect(JSON.parse(await readFile(path.join(root, "games", `${id}.json`), "utf8")).board).toBe(
      id,
    );
    expect(() => bootstrapGame(board.config)).not.toThrow();
    for (const params of [{ repeat: true }, { allowSelf: true }, { stage: 180 }, { maxUses: 2 }]) {
      const invalid = structuredClone(board.definition);
      invalid.roles.mirror_girl = params;
      expect(() => parseBoardDefinition(invalid)).toThrow("board_config_invalid_field");
    }
  });
