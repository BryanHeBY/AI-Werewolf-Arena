/**
 * 装配单元测试核公开两原板、两语／ACP游戏入口与真实parse/bootstrap往返；字面人数和拒绝项独立于生产支持谓词。
 * 配置只声明有限政策，不可透过extra字段、普通Hunter替换或高级合板取得本族运行支持。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Role } from "@ai-werewolf-arena/game-contract";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../../src/app/config/board-definition";
import { bootstrapGame } from "../../../../src/app/bootstrap";
function raw(size: number) {
  return JSON.parse(
    readFileSync(
      new URL(
        `../../../../../../configs.example/boards/awa_netease_dark_stars_${size}_v1.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  );
}
for (const size of [10, 12])
  test(`原${size}牌组真实parse/bootstrap和六个游戏入口一致`, () => {
    const b = parseBoardDefinition(raw(size)),
      g = bootstrapGame(b.config);
    expect(g.world.entityIds()).toHaveLength(size);
    expect(g.world.getEntityIdsByRole(Role.Wolf)).toHaveLength(size === 10 ? 2 : 3);
    expect(g.world.getEntityIdsByRole(Role.AwakenedWolfBeauty)).toHaveLength(1);
    expect(g.world.getEntityIdsByRole(Role.AwakenedHunter)).toHaveLength(1);
    expect(g.world.getEntityIdsByRole(Role.Hunter)).toEqual([]);
    expect(b.config.awakenedWolfBeauty).toEqual({ policy: "awa_awakened_replacement_v1" });
    expect(b.config.awakenedHunter).toEqual({ policy: "awa_directional_patrol_v1" });
    expect(
      parseBoardDefinition(boardDefinitionFromConfig(b.definition.id, b.config)).config,
    ).toEqual(b.config);
    for (const suffix of ["", "_en", "_acp"]) {
      const game = JSON.parse(
        readFileSync(
          new URL(
            `../../../../../../configs.example/games/${size === 10 ? "ten" : "twelve"}_player_dark_stars${suffix}.json`,
            import.meta.url,
          ),
          "utf8",
        ),
      );
      expect(game.board).toBe(b.definition.id);
      expect(game.locale).toBe(suffix === "_en" ? "en" : "zh-CN");
      expect(game.agent).toBe(suffix === "_acp" ? "acp_default" : "deepseek_v4_flash");
    }
  });
test("两族参数严格空对象，额外高级或普通猎人替换及不支持屠城均拒绝", () => {
  for (const role of ["awakened_hunter", "awakened_wolf_beauty"]) {
    for (const value of [{ policy: "other" }, { optional: true }]) {
      const r = raw(12);
      r.roles[role] = value;
      expect(() => parseBoardDefinition(r)).toThrow();
    }
  }
  const mix = raw(12);
  mix.board.roleSetups.find((r: { role: string }) => r.role === "guard").role = "dreamer";
  delete mix.roles.guard;
  mix.roles.dreamer = {};
  expect(() => parseBoardDefinition(mix)).toThrow();
  const hunter = raw(12);
  hunter.board.roleSetups.find((r: { role: string }) => r.role === "awakened_hunter").role =
    "hunter";
  delete hunter.roles.awakened_hunter;
  hunter.roles.hunter = {};
  expect(() => parseBoardDefinition(hunter)).toThrow();
  const city = raw(10);
  city.rules.winConditions = ["slaughter_city"];
  expect(() => parseBoardDefinition(city)).toThrow();
});
