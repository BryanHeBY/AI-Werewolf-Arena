import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadBoardDefinition } from "../../src/runtime/config/load_board_definition";
import { parseBoardDefinition } from "../../src/runtime/config/board_definition";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { resolveGameSetup } from "../../src/runtime/config/resolve_game_setup";

for (const [id, size] of [["six_player_wolf_king", 6], ["twelve_player_wolf_king", 12]] as const) test(`${id}: public board and game examples resolve a real wolf-king profile and reject undeclared variants`, async () => {
  const root = path.resolve(import.meta.dir, "../../../configs.example"), board = await loadBoardDefinition(root, id);
  const game = JSON.parse(await readFile(path.join(root, `games/${id}.json`), "utf8"));
  const runtime = parseRuntimeConfig({ providers: { default: "synthetic", items: { synthetic: { type: "openai", apiKey: "synthetic-only", baseURL: "http://127.0.0.1/v1" } } }, agents: { default: "deepseek_v4_flash", items: { deepseek_v4_flash: { kind: "llm", provider: "synthetic", model: "synthetic" } } }, game });
  const setup = resolveGameSetup(runtime, {}, board); expect(setup.boardConfig.boardSize).toBe(size);
  expect(board.config.roleSetups.find(entry => entry.role === "wolf_king")).toEqual({ role: "wolf_king", count: 1 });
  expect(game.printPrivateEvents).toBe(false);
  expect(() => parseBoardDefinition({ ...board.definition, roles: { ...board.definition.roles, wolf_king: { unlimitedShots: true } } })).toThrow("board_config_role_parameters_not_supported");
  const planned = structuredClone(board.definition); planned.board.roleSetups[0].role = "bear";
  expect(() => parseBoardDefinition(planned)).toThrow("board_config_role_not_implemented");
});
