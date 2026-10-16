/**
 * 配置文件系统集成测试读取既有公开六／十二人守墓人板子与游戏 JSON，并提供字面虚构变体或未注册身份，核对其解析为已注册被动 profile。明确的 profile／默认值及严格拒绝为预期；解析合成 provider 元数据但不请求模型。
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
  ["six_player_gravekeeper", 6],
  ["twelve_player_gravekeeper", 12],
] as const)
  test(`${id}: public examples resolve the passive profile and reject invented variants or unregistered roles`, async () => {
    const root = path.resolve(import.meta.dir, "../../../../../configs.example"),
      board = await loadBoardDefinition(root, id),
      game = JSON.parse(await readFile(path.join(root, `games/${id}.json`), "utf8"));
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
    expect(resolveGameSetup(runtime, {}, board).boardConfig.boardSize).toBe(size);
    expect(game.printPrivateEvents).toBe(false);
    expect(board.config.roleSetups.find((row) => row.role === "gravekeeper")).toEqual({
      role: Role.Gravekeeper,
      count: 1,
    });
    for (const parameters of [{ activeCheck: true }, { repeatLatest: true }, { revealRole: true }])
      expect(() =>
        parseBoardDefinition({
          ...board.definition,
          roles: { ...board.definition.roles, gravekeeper: parameters },
        }),
      ).toThrow(`board_config_invalid_field: roles.gravekeeper.${Object.keys(parameters)[0]}`);
    const unregistered = structuredClone(board.definition);
    unregistered.board.roleSetups[0].role = "unregistered_role";
    expect(() => parseBoardDefinition(unregistered)).toThrow(
      "board_config_invalid_field: board.roleSetups.0.role",
    );
  });
