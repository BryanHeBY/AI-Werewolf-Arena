/**
 * 配置文件系统集成测试读取原公开六／十二人机械狼板子与游戏 JSON，并提供四个手写虚构身份参数对象，核对声明的有限身份集合。精确人数、原生数量、空公开参数及严格参数拒绝为预期；只读原 JSON 字节。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { Role } from "../../../../src/domain";

for (const id of ["six_player_mechanical_wolf", "twelve_player_mechanical_wolf"])
  test(`${id}: public board and game examples load with the complete finite learning role set`, async () => {
    const root = path.resolve(import.meta.dir, "../../../../../configs.example"),
      board = await loadBoardDefinition(root, id);
    expect(board.config.boardSize).toBe(id.startsWith("six") ? 6 : 12);
    expect(board.config.roleSetups.find((s) => s.role === Role.MechanicalWolf)?.count).toBe(1);
    expect(board.definition.roles.mechanical_wolf).toEqual({});
    expect(JSON.parse(await readFile(path.join(root, "games", `${id}.json`), "utf8")).board).toBe(
      id,
    );
    expect(() => bootstrapGame(board.config)).not.toThrow();
    for (const value of [
      { skill: "guard" },
      { mode: "kill" },
      { recognizePack: true },
      { arbitrary: 1 },
    ]) {
      const invalid = structuredClone(board.definition);
      invalid.roles.mechanical_wolf = value;
      expect(() => parseBoardDefinition(invalid)).toThrow("board_config_invalid_field");
    }
  });
