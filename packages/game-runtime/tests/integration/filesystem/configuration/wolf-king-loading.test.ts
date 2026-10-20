/**
 * 配置文件系统集成测试读取既有公开六／十二人狼王板子与游戏 JSON，并提供字面未声明变体或未注册身份，核对原生 profile。明确的 profile／默认值及严格拒绝为预期；解析合成 provider 元数据但不发模型请求。
 */
import { Role } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import { parseRuntimeConfig } from "../../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../../src/app/config/resolve-game-setup";
for (const [id, size] of [
  ["six_player_wolf_king", 6],
  ["twelve_player_wolf_king", 12],
] as const)
  test(`${id}: public board and game examples resolve a real wolf-king profile and reject undeclared variants`, async () => {
    const root = path.resolve(import.meta.dir, "../../../../../../configs.example"),
      board = await loadBoardDefinition(root, id);
    const game = JSON.parse(await readFile(path.join(root, `games/${id}.json`), "utf8"));
    const runtime = parseRuntimeConfig({
      backends: {
        schemaVersion: 2,
        items: {
          synthetic: {
            kind: "llm",
            config: {
              type: "openai",
              apiKey: "synthetic-only",
              baseURL: "http://127.0.0.1/v1",
            },
          },
        },
      },
      agents: {
        schemaVersion: 2,
        default: "deepseek_v4_flash",
        items: {
          deepseek_v4_flash: {
            backend: "synthetic",
            options: {
              model: "synthetic",
            },
          },
        },
      },
      game,
    });
    const setup = resolveGameSetup(runtime, {}, board);
    expect(setup.boardConfig.boardSize).toBe(size);
    expect(board.config.roleSetups.find((entry) => entry.role === "wolf_king")).toEqual({
      role: Role.WolfKing,
      count: 1,
    });
    expect(game.printPrivateEvents).toBe(false);
    expect(() =>
      parseBoardDefinition({
        ...board.definition,
        roles: { ...board.definition.roles, wolf_king: { unlimitedShots: true } },
      }),
    ).toThrow("board_config_invalid_field: roles.wolf_king.unlimitedShots");
    const unregistered = structuredClone(board.definition);
    unregistered.board.roleSetups[0].role = "unregistered_role";
    expect(() => parseBoardDefinition(unregistered)).toThrow(
      "board_config_invalid_field: board.roleSetups.0.role",
    );
  });
