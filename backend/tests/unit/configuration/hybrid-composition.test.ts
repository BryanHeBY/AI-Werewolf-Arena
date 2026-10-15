/**
 * Unit tests verify Hybrid count and unsupported-role composition fail consistently at direct and normalized board entrances.
 * Input: The original ten unsupported-role values, duplicate count and literal board configuration.
 * Output and oracle: Explicit diagnostic codes/paths and direct rejection retain finite scope; no filesystem config tree or played game is needed.
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
