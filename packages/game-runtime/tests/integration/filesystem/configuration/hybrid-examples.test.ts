/**
 * 配置文件系统集成测试读取原公开六／十二人 Hybrid 文件及四个手写虚构参数对象，核对有限身份组合而非任意政策参数。精确数量／板子身份及严格参数拒绝为预期；示例字节与初始化行为保持原状。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";

for (const id of ["six_player_hybrid", "twelve_player_hybrid"])
  test(`${id}: finite examples load without arbitrary policies and direct bootstrap applies the same count/combination rules`, async () => {
    const root = path.resolve(import.meta.dir, "../../../../../../configs.example"),
      board = await loadBoardDefinition(root, id);
    expect(board.config.boardSize).toBe(id.startsWith("six") ? 6 : 12);
    expect(board.definition.roles.hybrid).toEqual({});
    expect(JSON.parse(await readFile(path.join(root, "games", `${id}.json`), "utf8")).board).toBe(
      id,
    );
    expect(() => bootstrapGame(board.config)).not.toThrow();
    for (const params of [
      { remaining: 2 },
      { reselect: true },
      { recognition: true },
      { followCurrentCamp: true },
    ]) {
      const invalid = structuredClone(board.definition);
      invalid.roles.hybrid = params;
      expect(() => parseBoardDefinition(invalid)).toThrow("board_config_invalid_field");
    }
  });
