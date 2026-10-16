/**
 * 单元测试负责公开board/game入口的引用完整性及真实配置装配；独立预期是文件名对应板ID、
 * 每块公开板至少一个game，以及两语装配得到同一牌池。只用公开文件和显式合成认证字符串，
 * 不读个人runtime、环境或密钥，不创建Agent、联网、付费或执行ACP命令。
 */
import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../src/app/config/resolve-game-setup";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
const root = new URL("../../../../configs.example/", import.meta.url),
  read = (name: string) => JSON.parse(readFileSync(new URL(name, root), "utf8")),
  files = (folder: string) =>
    readdirSync(new URL(folder, root))
      .filter((f) => f.endsWith(".json"))
      .sort();
test("每个公开board都有可解析game，全部game经两语正式装配且不分配模型资源", () => {
  const boards = new Map(
      files("boards/").map((name) => {
        const board = parseBoardDefinition(read(`boards/${name}`));
        expect(board.definition.id).toBe(name.slice(0, -5));
        return [board.definition.id, board] as const;
      }),
    ),
    referenced = new Set<string>(),
    agents = read("runtime/agents.json");
  for (const name of files("games/")) {
    const game = read(`games/${name}`),
      board = boards.get(game.board);
    expect(board, name).toBeDefined();
    referenced.add(game.board);
    for (const locale of ["zh-CN", "en"] as const) {
      const runtime = parseRuntimeConfig({
          environment: {},
          backends: read("runtime/backends.json"),
          agents,
          game: { ...game, locale, displayLocale: locale },
          debugSummary: { agent: { enabled: false } },
        }),
        setup = resolveGameSetup(runtime, {}, board!),
        actual = bootstrapGame(setup.boardConfig, { locale });
      expect(setup.boardDefinition?.definition.id, name).toBe(game.board);
      expect(actual.playerIds.length, name).toBe(board!.config.boardSize);
      expect(setup.context.locale).toBe(locale);
    }
  }
  expect([...boards.keys()].filter((id) => !referenced.has(id))).toEqual([]);
});
