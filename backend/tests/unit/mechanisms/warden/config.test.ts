/** 负责公开典狱长board/game与严格角色参数的单元／装配测试；使用字面板型与预期拒绝项验证真实parse/bootstrap，不从生产谓词生成oracle。 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/app/config/board-definition";
import { Role } from "@ai-werewolf-arena/game-contract";
function raw() {
  return JSON.parse(
    readFileSync(
      new URL(
        "../../../../../configs.example/boards/awa_warden_12_partner_native_v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}
test("完整公开board实际parse/bootstrap往返；两种game指向同一有限板", () => {
  const b = parseBoardDefinition(raw()),
    f = bootstrapGame(b.config);
  expect(f.world.getEntityIdsByRole(Role.Warden)).toHaveLength(1);
  expect(f.world.getEntityIdsByRole(Role.Wolf)).toHaveLength(3);
  expect(f.world.getEntityIdsByRole(Role.Dreamer)).toHaveLength(1);
  expect(b.config.warden).toEqual({
    policy: "awa_melbourne_warden_v1",
    forcePolicy: "awa_warden_partner_native_v1",
  });
  expect(parseBoardDefinition(boardDefinitionFromConfig(b.definition.id, b.config)).config).toEqual(
    b.config,
  );
  for (const suffix of ["", "_acp"]) {
    const game = JSON.parse(
      readFileSync(
        new URL(
          `../../../../../configs.example/games/twelve_player_warden${suffix}.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(game.board).toBe(b.definition.id);
    expect(game.agent).toBe(suffix ? "acp_default" : "deepseek_v4_flash");
  }
});
test("缺席和空对象取具名默认；未知force变体/字段与额外高级角色显式拒绝", () => {
  for (const omitted of [true, false]) {
    const r = raw();
    if (omitted) delete r.roles.warden;
    else r.roles.warden = {};
    expect(parseBoardDefinition(r).config.warden).toEqual({
      policy: "awa_melbourne_warden_v1",
      forcePolicy: "awa_warden_partner_native_v1",
    });
  }
  for (const value of [
    { policy: "other", forcePolicy: "awa_warden_partner_native_v1" },
    { policy: "awa_melbourne_warden_v1", forcePolicy: "any" },
    {
      policy: "awa_melbourne_warden_v1",
      forcePolicy: "awa_warden_partner_native_v1",
      unlimited: true,
    },
  ]) {
    const r = raw();
    r.roles.warden = value;
    expect(() => parseBoardDefinition(r)).toThrow();
  }
  const mix = raw();
  mix.board.roleSetups.find((r: { role: string }) => r.role === "villager").count = 3;
  mix.board.roleSetups.push({ role: "crow", count: 1 });
  expect(() => parseBoardDefinition(mix)).toThrow();
});
