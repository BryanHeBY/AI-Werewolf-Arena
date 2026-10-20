/**
 * 集成测试负责核对工作台补充板子时使用真实配置解析结果；输入省略板名或带空白的独立游戏 JSON。
 * 默认六人板与 trim 后文件名为手写预期，随后通过实际启动前检查，不运行模型或改变个人配置。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkConfig } from "ai-werewolf-arena-backend/config/check";
import { ConfigDocuments } from "../../src/server/config-documents";
import { ConfigService } from "../../src/server/config-service";

for (const [label, game] of [
  ["omitted board", {}],
  ["surrounding board whitespace", { board: " six_player_mvp " }],
] as const) {
  test(`${label} resolves the same template for validation and launch`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-board-resolution-"));
    try {
      for (const part of ["runtime", "games"]) await fs.mkdir(path.join(root, part));
      await fs.writeFile(
        path.join(root, "runtime/backends.json"),
        JSON.stringify({
          schemaVersion: 2,
          items: {
            offline: { kind: "llm", config: { type: "openai", apiKey: "synthetic-test-only" } },
          },
        }),
      );
      await fs.writeFile(
        path.join(root, "runtime/agents.json"),
        JSON.stringify({
          schemaVersion: 2,
          default: "offline",
          items: { offline: { backend: "offline", options: { model: "offline-model" } } },
        }),
      );
      await fs.writeFile(path.join(root, "games/game.json"), JSON.stringify(game));
      const documents = new ConfigDocuments(root);
      const service = new ConfigService(
        documents,
        path.resolve(import.meta.dir, "../../../../configs.example"),
      );
      await expect(service.validate("games", "game", game)).resolves.toBeUndefined();
      expect(await documents.list("boards")).toEqual([]);
      await service.ensureGameBoard("game");
      expect(await documents.list("boards")).toEqual(["six_player_mvp"]);
      expect((await checkConfig(root, "game")).board).toBe("six_player_mvp");
      expect(JSON.parse(await fs.readFile(path.join(root, "games/game.json"), "utf8"))).toEqual(
        game,
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
}
