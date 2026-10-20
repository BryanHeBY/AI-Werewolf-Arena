/**
 * 负责觉醒狼王来源板和公开示例的独立配置测试。输入为十／十二人原牌组及手写坏变体，
 * 预期为精确人数、女巫自救／梦保护和严格空参数；预检与 bootstrap 都必须成功或同因拒绝。
 * 不运行完整对局或付费模型，不修改操作者私人配置。
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Role } from "@ai-werewolf-arena/game-contract";
import {
  awakenedWolfKingTenConfig,
  awakenedWolfKingTwelveConfig,
} from "../../../../src/rulesets/presets/awakened-wolf-king";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../../src/app/bootstrap";
for (const size of [10, 12])
  test(`source ${size}-player board roundtrips with strict empty role parameters`, () => {
    const config = structuredClone(
        size === 10 ? awakenedWolfKingTenConfig : awakenedWolfKingTwelveConfig,
      ),
      raw = boardDefinitionFromConfig(`king_${size}`, config);
    expect(raw.roles.awakened_wolf_king).toEqual({});
    expect(raw.board.roleSetups).toEqual([
      { role: "wolf", count: size === 10 ? 2 : 3 },
      { role: "awakened_wolf_king", count: 1 },
      { role: "villager", count: 4 },
      { role: "seer", count: 1 },
      { role: "witch", count: 1 },
      { role: "miracle_merchant", count: 1 },
      ...(size === 12 ? [{ role: "dreamer", count: 1 }] : []),
    ]);
    const board = parseBoardDefinition(raw),
      f = bootstrapGame(board.config);
    expect(f.world.getAliveEntityIds()).toHaveLength(size);
    expect(f.world.getEntityIdsByRole(Role.AwakenedWolfKing)).toHaveLength(1);
    const badParameter = structuredClone(raw);
    badParameter.roles.awakened_wolf_king = { policy: "awa_awakened_wolf_king_v1" };
    expect(() => parseBoardDefinition(badParameter)).toThrow();
    const badSelfHeal = structuredClone(raw);
    (badSelfHeal.roles.witch as Record<string, unknown>).selfHeal =
      size === 10 ? "disabled" : "first_night_only";
    expect(() => parseBoardDefinition(badSelfHeal)).toThrow("awakened_wolf_king_preset_invalid");
    const mixed = structuredClone(raw);
    mixed.board.roleSetups.find((r) => r.role === "villager")!.count--;
    mixed.board.roleSetups.push({ role: "hunter", count: 1 });
    expect(() => parseBoardDefinition(mixed)).toThrow();
    if (size === 12) {
      const badDream = structuredClone(raw);
      badDream.roles.dreamer = { protectionPolicy: "netease_2026_night_immunity_v1" };
      expect(() => parseBoardDefinition(badDream)).toThrow("awakened_wolf_king_preset_invalid");
    }
  });
test("both public source boards and six LLM/English/ACP game examples reference parseable public inputs", async () => {
  const root = path.resolve(import.meta.dir, "../../../../../..");
  for (const [size, prefix] of [
    [10, "ten"],
    [12, "twelve"],
  ] as const) {
    const id = `awa_awakened_wolf_king_${size}_v1`;
    const board = parseBoardDefinition(
      JSON.parse(await readFile(path.join(root, "configs.example/boards", `${id}.json`), "utf8")),
    );
    expect(board.definition.id).toBe(id);
    expect(bootstrapGame(board.config).world.getAliveEntityIds()).toHaveLength(size);
    for (const variant of ["", "_en", "_acp"]) {
      const game = JSON.parse(
        await readFile(
          path.join(
            root,
            "configs.example/games",
            `${prefix}_player_awakened_wolf_king${variant}.json`,
          ),
          "utf8",
        ),
      );
      expect(game.board).toBe(id);
      expect(game.locale).toBe(variant === "_en" ? "en" : "zh-CN");
      expect(game.agent).toBe(variant === "_acp" ? "acp_default" : "deepseek_v4_flash");
    }
  }
});
