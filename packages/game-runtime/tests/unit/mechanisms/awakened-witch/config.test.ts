/**
 * 负责公开觉醒女巫board/game的真实配置入口验收；手写政策与原十二人牌池给出预期。
 * 核严格空参数、往返、有限混搭和自救开关拒绝，不使用生产support函数生成答案。
 * 单元测试经过实际公开配置解析与装配入口，独立预期为来源规定的固定十二人牌池。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Role } from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../../src/app/config/board-definition";
const raw = () =>
  JSON.parse(
    readFileSync(
      new URL(
        "../../../../../configs.example/boards/awa_awakened_witch_12_v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
test("原十二人双觉醒公开板真实parse/bootstrap往返，三种game指向同一板", () => {
  const b = parseBoardDefinition(raw()),
    f = bootstrapGame(b.config);
  expect(f.playerIds).toHaveLength(12);
  for (const role of [Role.AwakenedWitch, Role.AwakenedWolfKing, Role.Guard, Role.Hunter])
    expect(f.world.getEntityIdsByRole(role)).toHaveLength(1);
  expect(b.config.awakenedWitch).toEqual({ policy: "awa_awakened_witch_v1" });
  expect(parseBoardDefinition(boardDefinitionFromConfig(b.definition.id, b.config)).config).toEqual(
    b.config,
  );
  for (const suffix of ["", "_acp", "_en"]) {
    const g = JSON.parse(
      readFileSync(
        new URL(
          `../../../../../configs.example/games/twelve_player_awakened_witch${suffix}.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(g.board).toBe(b.definition.id);
    expect(g.locale).toBe(suffix === "_en" ? "en" : "zh-CN");
    expect(g.agent).toBe(suffix === "_acp" ? "acp_default" : "deepseek_v4_flash");
  }
});
test("缺席/空对象取固定默认；未裁决自救与第四轮、额外角色和未知字段拒绝", () => {
  const omitted = raw();
  delete omitted.roles.awakened_witch;
  expect(parseBoardDefinition(omitted).config.awakenedWitch).toEqual({
    policy: "awa_awakened_witch_v1",
  });
  for (const value of [{ canSelfHeal: true }, { attempts: 4 }, { policy: "other" }]) {
    const r = raw();
    r.roles.awakened_witch = value;
    expect(() => parseBoardDefinition(r)).toThrow();
  }
  const mix = raw();
  mix.board.roleSetups.find((r: { role: string }) => r.role === "villager").count = 3;
  mix.board.roleSetups.push({ role: "dreamer", count: 1 });
  expect(() => parseBoardDefinition(mix)).toThrow();
});
