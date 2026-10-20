/**
 * 单元测试将原九种不支持身份及重复原生数量送入公开归一化和直接 bootstrap，核对魔镜少女数量／组合在安装前的诊断。精确数量／组合错误码及路径为预期；不需要公开 JSON 文件或完整对局。
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
  Role.MiracleMerchant,
  Role.MechanicalWolf,
  Role.Hybrid,
  Role.Bear,
  Role.WolfBeauty,
  Role.WhiteWolfKing,
  Role.Knight,
  Role.Dreamer,
  Role.Gravekeeper,
])
  test(`${unsupported}: MirrorGirl board scope is explicit and safely diagnosed`, () => {
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      roleSetups: [
        { role: Role.MirrorGirl, count: 1 },
        { role: Role.Wolf, count: 1 },
        { role: unsupported, count: 1 },
        { role: Role.Villager, count: 3 },
      ],
    };
    expect(() => bootstrapGame(config)).toThrow("role_combination_not_supported");
    try {
      parseBoardDefinition(boardDefinitionFromConfig("mirror_girl_unsupported", config));
      throw new Error("must reject");
    } catch (error) {
      expect(configDiagnostic(error)).toEqual({
        code: "board_config_role_combination_not_supported",
        path: "board.roleSetups",
      });
    }
  });

test("native mirror_girl count is one in both entrypoints", () => {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [
      { role: Role.MirrorGirl, count: 2 },
      { role: Role.Wolf, count: 1 },
      { role: Role.Villager, count: 3 },
    ],
  };
  expect(() => bootstrapGame(config)).toThrow("role_count_exceeds_limit");
  expect(() =>
    parseBoardDefinition(boardDefinitionFromConfig("mirror_girl_duplicate", config)),
  ).toThrow("board_config_invalid_field");
});
