/**
 * Unit tests check named Hidden Wolf camp policy configuration, prompts and own-state projection. Inputs are literal policy/locale matrices and malformed parameters; literal normalized fields, prompt fragments and absent foreign state are the oracle. No complete phase cycle runs here; inheritance and Knight interaction stay in scenarios.
 */
import {
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
} from "../../../../src/game/mechanisms";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type ActionRequest, type BoardConfig, type HiddenWolfCampInspectionPolicy, type RoleComponent } from "../../../../src/core";
import { getHiddenWolfState } from "../../../../src/game/mechanisms/roles/private_state";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import { getDefaultConfigRenderRegistry } from "../../../../src/game/mechanisms/prompt/config_render_registry";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";

const roles = [Role.HiddenWolf, Role.Wolf, Role.Seer, Role.Knight, Role.Villager, Role.Villager];

const catalog = getDefaultRoleCatalog();

function setup(campInspection?: HiddenWolfCampInspectionPolicy, locale: "en" | "zh-CN" = "en") {
  const board: BoardConfig = {
    ...sixPlayerMvpConfig,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((item) => item === role).length,
    })),
    ...(campInspection ? { hiddenWolf: { campInspection } } : {}),
  };
  const resolved = parseBoardDefinition(boardDefinitionFromConfig("hidden_policy", board));
  return { ...bootstrapGame(resolved.config, { fixedRoles: roles, locale }), ...resolved };
}

for (const campInspection of ["awa_inheritance_v1", "netease_2020_good_v1"] as const) {
  for (const locale of ["zh-CN", "en"] as const)
    test(`${campInspection}/${locale}: configuration, role prompt and own DTO agree without exposing another player's state`, () => {
      const game = setup(campInspection, locale);
      expect(game.definition.roles.hidden_wolf).toEqual({ campInspection });
      expect(boardDefinitionFromConfig(game.definition.id, game.config)).toEqual(game.definition);
      expect(
        getDefaultConfigRenderRegistry().renderBoardConfigPrompt(game.config, locale),
      ).toContain(campInspection);
      const hidden = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!;
      const prompt = hidden.renderPrompt(locale);
      expect(prompt).toContain(
        campInspection === "netease_2020_good_v1"
          ? campInspection
          : locale === "en"
            ? "once inherited inspection shows Wolf"
            : "曾接刀后查验狼",
      );
      const request: ActionRequest = {
        actorId: 1,
        phase: Phase.Day,
        allowedTools: ["speak"],
        context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
      };
      const policy = new PlayerPromptPolicy(game.world, {
        boardConfig: game.config,
        roleCatalog: catalog,
        toolSpecRegistry: getDefaultToolSpecRegistry(),
        targetHintRegistry: getDefaultTargetHintRegistry(),
        phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
        configRenderRegistry: getDefaultConfigRenderRegistry(),
      });
      expect(policy.buildObservation(request).ownState.hiddenWolf).toEqual({
        hasInheritedKnife: false,
        canVoteForKill: false,
        ...(campInspection === "netease_2020_good_v1" ? { campInspection } : {}),
      });
      expect(
        policy.buildObservation({ ...request, actorId: 2 }).ownState.hiddenWolf,
      ).toBeUndefined();
    });
}

test("omission preserves the legacy raw state and unknown policies fail closed", () => {
  const game = setup();
  expect(game.definition.roles.hidden_wolf).toEqual({ campInspection: "awa_inheritance_v1" });
  expect(getHiddenWolfState(game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!)).toEqual({
    hasInheritedKnife: false,
  });
  for (const bad of [
    { campInspection: "future" },
    { campInspeciton: "netease_2020_good_v1" },
    { bearDetects: false },
  ]) {
    expect(() =>
      parseBoardDefinition({
        ...game.definition,
        roles: { ...game.definition.roles, hidden_wolf: bad },
      }),
    ).toThrow("board_config_invalid_field");
  }
});
