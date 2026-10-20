/**
 * 单元测试将原按 Role 过滤的不支持身份矩阵及重复数量送入归一化和直接 bootstrap，核对机械狼数量／有限学习范围在开局前拒绝不支持组合。精确政策诊断码为预期；不加载公开示例、传输或完整游戏。
 */
import { expect, test } from "bun:test";
import path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  parseBoardDefinition,
  boardDefinitionFromConfig,
} from "../../../src/app/config/board-definition";
import { Role, type BoardConfig } from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { configDiagnostic } from "../../../src/app/config/error-codes";

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
      (
        {
          warden: "warden_preset_invalid",
          crow: "crow_preset_invalid",
          silence_elder: "silence_elder_preset_invalid",
          awakened_wolf_king: "awakened_wolf_king_preset_invalid",
          awakened_witch: "awakened_witch_preset_invalid",
          awakened_wolf_beauty: "awakened_dark_stars_preset_invalid",
          awakened_hunter: "awakened_dark_stars_preset_invalid",
          awakened_guard: "awakened_day_roles_preset_invalid",
          awakened_knight: "awakened_day_roles_preset_invalid",
        } as Partial<Record<Role, string>>
      )[unsupported] ??
        ([Role.WhiteCat, Role.FoxCub, Role.Pufferfish].includes(unsupported)
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
                                          : "role_combination_not_supported"),
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
