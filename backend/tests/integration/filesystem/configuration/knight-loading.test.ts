/**
 * 配置文件系统集成测试读取既有公开六／十二人骑士板子与游戏 JSON，并修改为不支持的窗口、身份或变体，核对离散决斗窗口政策。精确已注册骑士默认值与验证失败为预期；不执行决斗或 provider 调用。
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { parseRuntimeConfig } from "../../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../../src/app/config/resolve-game-setup";
import { KnightDuelWindow } from "../../../../src/domain";

for (const [id, size] of [
  ["six_player_knight", 6],
  ["twelve_player_knight", 12],
] as const)
  test(`${id}: public board/game examples resolve a real Knight and strictly validate discrete windows`, async () => {
    const root = path.resolve(import.meta.dir, "../../../../../configs.example"),
      board = await loadBoardDefinition(root, id);
    const game = JSON.parse(await readFile(path.join(root, `games/${id}.json`), "utf8"));
    const runtime = parseRuntimeConfig({
      providers: {
        default: "synthetic",
        items: {
          synthetic: { type: "openai", apiKey: "synthetic-only", baseURL: "http://127.0.0.1/v1" },
        },
      },
      agents: {
        default: "deepseek_v4_flash",
        items: { deepseek_v4_flash: { kind: "llm", provider: "synthetic", model: "synthetic" } },
      },
      game,
    });
    expect(resolveGameSetup(runtime, {}, board).boardConfig.boardSize).toBe(size);
    expect(board.config.knight).toEqual({ enabledWindows: [KnightDuelWindow.AfterSpeeches] });
    expect(game.printPrivateEvents).toBe(false);
    const configured = (parameters: unknown) =>
      parseBoardDefinition({
        ...board.definition,
        roles: { ...board.definition.roles, knight: parameters },
      });
    expect(configured({}).config.knight).toEqual({
      enabledWindows: [KnightDuelWindow.AfterSpeeches],
    });
    expect(configured({ enabledWindows: [] }).config.knight).toEqual({ enabledWindows: [] });
    expect(
      configured({ enabledWindows: Object.values(KnightDuelWindow) }).config.knight?.enabledWindows,
    ).toEqual(Object.values(KnightDuelWindow));
    for (const parameters of [
      { enabledWindows: ["on_pre_vote"] },
      { enabledWindows: ["after_speeches", "after_speeches"] },
      { continuous: true },
    ])
      expect(() => configured(parameters)).toThrow();
    const unsupported = structuredClone(board.definition);
    unsupported.board.roleSetups[0].role = "awakened_knight";
    expect(() => parseBoardDefinition(unsupported)).toThrow("board_config_role_not_implemented");
  });
