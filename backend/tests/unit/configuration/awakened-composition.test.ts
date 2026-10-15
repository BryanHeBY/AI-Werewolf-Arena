/**
 * Unit tests verify Awakened Hidden Wolf count and unsupported-role combinations are rejected consistently before installation.
 * Input: Original literal extra-role and duplicate-count matrices passed to board normalization and direct bootstrap.
 * Output and oracle: Explicit combination/count diagnostic codes remain unchanged; no example file or complete game is loaded by these cases.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Role, type BoardConfig } from "../../../src/domain";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/app/config/board-definition";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

for (const extra of [
  Role.Seer,
  Role.HiddenWolf,
  Role.Gargoyle,
  Role.Psychic,
  Role.MechanicalWolf,
  Role.MiracleMerchant,
  Role.Hybrid,
  Role.Dreamer,
  Role.WolfBeauty,
  Role.WolfKing,
  Role.WhiteWolfKing,
  Role.Idiot,
])
  test(`${extra}: both board entrypoints reject undeclared Aw joint rules`, () => {
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      roleSetups: [
        { role: Role.AwakenedHiddenWolf, count: 1 },
        { role: Role.Wolf, count: 1 },
        { role: extra, count: 1 },
        { role: Role.Villager, count: 3 },
      ],
    };
    expect(() => bootstrapGame(config)).toThrow("role_combination_not_supported");
    expect(() => parseBoardDefinition(boardDefinitionFromConfig("aw_invalid", config))).toThrow(
      "board_config_role_combination_not_supported",
    );
  });

test("Awakened native count is at most one through parse and direct bootstrap", () => {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [
      { role: Role.AwakenedHiddenWolf, count: 2 },
      { role: Role.Wolf, count: 1 },
      { role: Role.Villager, count: 3 },
    ],
  };
  expect(() => bootstrapGame(config)).toThrow("role_count_exceeds_limit");
  expect(() => parseBoardDefinition(boardDefinitionFromConfig("aw_duplicate", config))).toThrow(
    "board_config_invalid_field",
  );
});
