/**
 * Unit tests verify Mirror Girl count and unsupported-role composition diagnostics before installation.
 * Input: Original nine unsupported role values and duplicate native count through public normalization and direct bootstrap.
 * Output and oracle: Exact count/combination error codes and paths preserve the original assertions; no public JSON file or played game is required.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { Role, type BoardConfig } from "../../../src/core";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/runtime/config/board_definition";
import { configDiagnostic } from "../../../src/runtime/config/error_codes";

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
