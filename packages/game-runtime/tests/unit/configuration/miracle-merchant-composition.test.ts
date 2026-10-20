/**
 * 单元测试将原九种不支持身份及重复原生数量送入归一化和直接 bootstrap，核对奇迹商人数量／组合在同一配置入口拒绝。精确组合／数量码及路径为预期；不使用文件系统树或游戏循环。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { Role, type BoardConfig } from "../../../src/domain";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/app/config/board-definition";
import { configDiagnostic } from "../../../src/app/config/error-codes";

for (const unsupported of [
  Role.MechanicalWolf,
  Role.Psychic,
  Role.Gargoyle,
  Role.Bear,
  Role.WolfBeauty,
  Role.WhiteWolfKing,
  Role.Knight,
  Role.Idiot,
  Role.Gravekeeper,
])
  test(`${unsupported}: Miracle board scope is explicit and safely diagnosed`, () => {
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      roleSetups: [
        { role: Role.MiracleMerchant, count: 1 },
        { role: Role.Wolf, count: 1 },
        { role: unsupported, count: 1 },
        { role: Role.Villager, count: 3 },
      ],
    };
    expect(() => bootstrapGame(config)).toThrow("role_combination_not_supported");
    try {
      parseBoardDefinition(boardDefinitionFromConfig("merchant_unsupported", config));
      throw new Error("must reject");
    } catch (error) {
      expect(configDiagnostic(error)).toEqual({
        code: "board_config_role_combination_not_supported",
        path: "board.roleSetups",
      });
    }
  });

test("native merchant count is one in both entrypoints", () => {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [
      { role: Role.MiracleMerchant, count: 2 },
      { role: Role.Wolf, count: 1 },
      { role: Role.Villager, count: 3 },
    ],
  };
  expect(() => bootstrapGame(config)).toThrow("role_count_exceeds_limit");
  expect(() =>
    parseBoardDefinition(boardDefinitionFromConfig("merchant_duplicate", config)),
  ).toThrow("board_config_invalid_field");
});
