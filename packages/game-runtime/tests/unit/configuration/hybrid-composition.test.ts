/**
 * 单元测试以原十种不支持身份、重复数量及字面配置为输入，核对 Hybrid 数量／组合在直接及归一化入口一致拒绝。明确诊断码／路径和直接拒绝为预期；不需要文件系统配置树或完整对局。
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
  Role.Psychic,
  Role.Gargoyle,
  Role.Bear,
  Role.WolfBeauty,
  Role.WhiteWolfKing,
  Role.Knight,
  Role.Dreamer,
  Role.Gravekeeper,
])
  test(`${unsupported}: Hybrid board scope is explicit and safely diagnosed`, () => {
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      roleSetups: [
        { role: Role.Hybrid, count: 1 },
        { role: Role.Wolf, count: 1 },
        { role: unsupported, count: 1 },
        { role: Role.Villager, count: 3 },
      ],
    };
    expect(() => bootstrapGame(config)).toThrow("role_combination_not_supported");
    try {
      parseBoardDefinition(boardDefinitionFromConfig("hybrid_unsupported", config));
      throw new Error("must reject");
    } catch (error) {
      expect(configDiagnostic(error)).toEqual({
        code: "board_config_role_combination_not_supported",
        path: "board.roleSetups",
      });
    }
  });

test("native hybrid count is one in both entrypoints", () => {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [
      { role: Role.Hybrid, count: 2 },
      { role: Role.Wolf, count: 1 },
      { role: Role.Villager, count: 3 },
    ],
  };
  expect(() => bootstrapGame(config)).toThrow("role_count_exceeds_limit");
  expect(() => parseBoardDefinition(boardDefinitionFromConfig("hybrid_duplicate", config))).toThrow(
    "board_config_invalid_field",
  );
});
