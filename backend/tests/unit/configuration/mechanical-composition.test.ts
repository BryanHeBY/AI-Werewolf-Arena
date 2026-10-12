/**
 * Unit tests verify Mechanical Wolf count and finite learning scope reject unsupported board compositions before play.
 * Input: Original Role-filtered unsupported-role matrix and duplicate count through public normalization and direct bootstrap.
 * Output and oracle: Exact policy-specific diagnostic codes preserve the original assertions; no public example file, transport or complete game is loaded.
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/runtime/config/board_definition";
import { Role, type BoardConfig } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { configDiagnostic } from "../../../src/runtime/config/error_codes";

for (const unsupported of Object.values(Role).filter(
  (role) =>
    ![
      Role.Wolf,
      Role.Psychic,
      Role.Witch,
      Role.Hunter,
      Role.Guard,
      Role.Villager,
      Role.MechanicalWolf,
    ].includes(role),
))
  test(`${unsupported}: parse and direct bootstrap reject a board outside mechanical learning scope before play`, () => {
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      roleSetups: [
        { role: Role.MechanicalWolf, count: 1 },
        { role: Role.Wolf, count: 1 },
        { role: unsupported, count: 1 },
        { role: Role.Villager, count: 3 },
      ],
    };
    expect(() =>
      parseBoardDefinition(boardDefinitionFromConfig("mechanical_unsupported", config)),
    ).toThrow("board_config_role_combination_not_supported");
    expect(() => bootstrapGame(config)).toThrow(
      [Role.WhiteCat, Role.FoxCub, Role.Pufferfish].includes(unsupported)
        ? "animal_dream_preset_invalid"
        : unsupported === Role.FragrantPhantom || unsupported === Role.AwakenedSeer
          ? "fragrant_pair_seer_preset_invalid"
          : unsupported === Role.NightNoble || unsupported === Role.AwakenedIdiot
            ? "noble_secret_body_preset_invalid"
            : unsupported === Role.RadiantCount || unsupported === Role.EclipseMaid
              ? "radiant_eclipse_preset_invalid"
              : unsupported === Role.Alchemist || unsupported === Role.RavenClawWolf
                ? "mist_raven_preset_invalid"
                : unsupported === Role.DayScholar || unsupported === Role.NightMentor
                  ? "scholar_mentor_preset_invalid"
                  : unsupported === Role.TimeWolfConsort
                    ? "time_consort_preset_invalid"
                    : unsupported === Role.WolfSorcerer
                      ? "wolf_sorcerer_preset_invalid"
                      : unsupported === Role.Trickster
                        ? "trickster_preset_invalid"
                        : unsupported === Role.Magician
                          ? "magician_preset_invalid"
                          : unsupported === Role.RedMoonApostle
                            ? "red_moon_preset_invalid"
                            : unsupported === Role.NightmareShadow
                              ? "nightmare_preset_invalid"
                              : unsupported === Role.EvilKnight
                                ? "evil_knight_preset_invalid"
                                : unsupported === Role.OrderPrince
                                  ? "order_prince_preset_invalid"
                                  : unsupported === Role.GhostBride
                                    ? "ghost_bride_preset_invalid"
                                    : unsupported === Role.DemonHunter
                                      ? "demon_hunter_preset_invalid"
                                      : unsupported === Role.PureWhiteGirl ||
                                          unsupported === Role.WolfWitch
                                        ? "pure_white_preset_invalid"
                                        : "role_combination_not_supported",
    );
    try {
      parseBoardDefinition(boardDefinitionFromConfig("mechanical_unsupported", config));
      throw new Error("expected unsupported board");
    } catch (error) {
      expect(configDiagnostic(error)).toEqual({
        code: "board_config_role_combination_not_supported",
        path: "board.roleSetups",
      });
    }
  });

test("both entrypoints enforce one native mechanical wolf", () => {
  const config: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [
      { role: Role.MechanicalWolf, count: 2 },
      { role: Role.Witch, count: 1 },
      { role: Role.Villager, count: 3 },
    ],
  };
  expect(() =>
    parseBoardDefinition(boardDefinitionFromConfig("mechanical_duplicate", config)),
  ).toThrow("board_config_invalid_field");
  expect(() => bootstrapGame(config)).toThrow("role_count_exceeds_limit");
});
