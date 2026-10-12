/**
 * Assembles witch native potion configuration, state initialization, prompt text, tools, night stages and production fallback.
 * Inputs are role initialization/configuration and existing runtime contexts; output is
 * a RoleProfile contribution. Native state access delegates to its owning feature leaf.
 * Existing validation, lifecycle and effect ordering remain their specific contributions;
 * This module does not own archive encoding or create a second state store.
 */
import { roleName, text } from "@ai-werewolf-arena/game-text";
/** 文件说明：女巫角色 profile。 */
import { Camp, PotionType, Role, WitchSelfHealRule } from "../../../../core/domain/model";
import { RoleProfile } from "../contracts";
import { getWitchState, setWitchState } from "./state";
import { WITCH_LLM_REPAIR_PACK } from "./llm_repair";
import { WITCH_NIGHT_STAGES } from "./night_stages";
import { WITCH_TOOL_SPECS, WITCH_STAGE_DIRECTIVES } from "./tool_specs";
import { WITCH_VALIDATION_RULES } from "./validation_rules";
import { z } from "zod";
import {
  WITCH_KNIFE_VISIBILITY_POLICIES,
  WITCH_POTION_POLICIES,
} from "../../../../core/domain/board";

const witchParameters = z.strictObject({
  selfHeal: z.enum(WitchSelfHealRule).default(WitchSelfHealRule.Disabled),
  knifeVisibility: z.enum(WITCH_KNIFE_VISIBILITY_POLICIES).default("awa_with_heal_v1"),
  potionPolicy: z.enum(WITCH_POTION_POLICIES).default("awa_one_native_v1"),
});

/** 女巫角色配置。 */
export const WITCH_ROLE_PROFILE: RoleProfile = {
  role: Role.Witch,
  camp: Camp.Good,
  label: roleName("witch"),
  skillBrief: text("zh-CN", "role.witch.brief"),
  goodSide: "god",
  configuration: {
    schema: witchParameters,
    defaults: {
      selfHeal: WitchSelfHealRule.Disabled,
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    apply: (config, value) => {
      const parameters = witchParameters.parse(value);
      return {
        ...config,
        witch: {
          canSelfHeal: parameters.selfHeal,
          knifeVisibility: parameters.knifeVisibility,
          potionPolicy: parameters.potionPolicy,
        },
      };
    },
    serialize: (config) =>
      witchParameters.parse({
        selfHeal: config.witch?.canSelfHeal ?? WitchSelfHealRule.Disabled,
        knifeVisibility: config.witch?.knifeVisibility,
        potionPolicy: config.witch?.potionPolicy,
      }),
  },
  init: (roleComp, ctx) => {
    const selfHealRule = ctx.boardConfig?.witch?.canSelfHeal ?? WitchSelfHealRule.Disabled;
    setWitchState(roleComp, {
      heal: 1,
      poison: 1,
      selfHealRule,
      canSelfHeal:
        selfHealRule === WitchSelfHealRule.Always ||
        selfHealRule === WitchSelfHealRule.FirstNightOnly,
      ...(ctx.boardConfig?.witch?.knifeVisibility &&
      ctx.boardConfig.witch.knifeVisibility !== "awa_with_heal_v1"
        ? { knifeVisibility: ctx.boardConfig.witch.knifeVisibility }
        : {}),
      ...(ctx.boardConfig?.witch?.potionPolicy === "awa_both_native_experimental_v1"
        ? { potionPolicy: ctx.boardConfig.witch.potionPolicy }
        : {}),
      healUsedThisNight: false,
      poisonUsedThisNight: false,
    });
  },
  renderPrompt: (roleComp, locale = "zh-CN") =>
    text(locale, "role.witch.state", {
      heal: getWitchState(roleComp)?.heal ?? 0,
      poison: getWitchState(roleComp)?.poison ?? 0,
    }) +
    " " +
    text(
      locale,
      getWitchState(roleComp)?.knifeVisibility === "awa_always_v1"
        ? "role.witch.knife_always"
        : "role.witch.knife_with_heal",
    ) +
    " " +
    text(
      locale,
      getWitchState(roleComp)?.potionPolicy === "awa_both_native_experimental_v1"
        ? "role.witch.potions_both"
        : "role.witch.potions_one",
    ),
  toolSpecs: WITCH_TOOL_SPECS,
  stageDirectives: WITCH_STAGE_DIRECTIVES,
  validationRules: WITCH_VALIDATION_RULES,
  nightStages: WITCH_NIGHT_STAGES,
  llmRepair: WITCH_LLM_REPAIR_PACK,
  baselineAction: (roleComp, request) => {
    if (!request.allowedTools.includes("use_potion")) {
      return null;
    }
    return {
      name: "use_potion",
      args: {
        target_id: request.actorId,
        potion_type: PotionType.None,
      },
    };
  },
};
