/**
 * 负责觉醒狼美人的有限资料与实际装配。输入严格空配置及原角色容器，输出唯一替死库存、原狼队能力和魅惑夜窗。
 * 自爆／自刀投票明确禁止，群狼其他投票不改。展示使用本族纯值贡献，不加入中央捕获；资料与预检不授予付款或死亡权。
 */
import { z } from "zod";
import { Role, Phase, WinCondition, RuleError } from "@ai-werewolf-arena/game-contract";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import {
  AWAKENED_BEAUTY_POLICY,
  readAwakenedBeautyStateData,
} from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import type { RoleContributions } from "../../rulesets/roles/contracts";
import { ownRoleCallback, roleMethod } from "../../rulesets/roles/owned-bindings";
import { ownedToolRules, invokeValidationRule } from "../../engine/actions/validation-queries";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { initializeAwakenedBeautyState } from "./state";
import { awakenedCharmChoiceAllowed } from "./authority";
import { AWAKENED_BEAUTY_PREPARE_STAGE, AWAKENED_CHARM_STAGE } from "./night-stage";
import { awakenedBeautyPromptState } from "./presentation";
const parameters = z.strictObject({});
export const AWAKENED_BEAUTY_PROFILE: RoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    role: Role.AwakenedWolfBeauty,
    label: roleName("awakened_wolf_beauty"),
    skillBrief: text("zh-CN", "role.awakened_wolf_beauty.brief"),
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Guard,
      Role.AwakenedHunter,
      Role.AwakenedWolfBeauty,
      Role.AwakenedGuard,
      Role.AwakenedKnight,
    ],
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    canSelfDestruct: false,
    init: ownRoleCallback("init", { init: (role) => initializeAwakenedBeautyState(role) }),
    configuration: {
      schema: parameters,
      defaults: {},
      apply: (config, value) => {
        parameters.parse(value);
        return { ...config, awakenedWolfBeauty: { policy: AWAKENED_BEAUTY_POLICY } };
      },
      serialize: () => ({}),
    },
    toolSpecs: [
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs!,
      {
        name: "awakened_charm",
        parameters: {
          type: "object",
          properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'awakened_charm args: {"target_id":number|null}',
        userPromptHintKey: "action.awakened_charm.hint",
      },
    ],
    validationRules: ownedToolRules({
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      kill_vote: (ctx) =>
        ctx.toolCall.name === "kill_vote" &&
        !ctx.toolCall.args.abstain &&
        ctx.toolCall.args.target_id === ctx.actorId
          ? { code: RuleError.KillTarget }
          : invokeValidationRule(
              ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules!.kill_vote!,
              ctx,
            ),
      awakened_charm: (ctx) =>
        ctx.phase === Phase.Night &&
        ctx.day !== undefined &&
        ctx.toolCall.name === "awakened_charm" &&
        awakenedCharmChoiceAllowed(ctx.world, ctx.actorId, ctx.day, ctx.toolCall.args.target_id)
          ? null
          : { code: RuleError.CustomRuleError },
    }),
    nightStages: [
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages!,
      AWAKENED_BEAUTY_PREPARE_STAGE,
      AWAKENED_CHARM_STAGE,
    ],
    stageDirectives: [
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.stageDirectives!,
      {
        match: (tools) => tools.length === 1 && tools[0] === "awakened_charm",
        messageKey: "action.awakened_charm.directive",
        text: text("zh-CN", "action.awakened_charm.directive"),
      },
    ],
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (role, request, pick, camp, locale, world, currentCamp) =>
        request.allowedTools.includes("awakened_charm")
          ? {
              name: "awakened_charm",
              args: { target_id: request.context.awakened_charm_candidates?.[0] ?? null },
            }
          : roleMethod(ORDINARY_WOLF_CONTRIBUTIONS.runtime, "baselineAction")!(
              role,
              request,
              pick,
              camp,
              locale,
              world,
              currentCamp,
            ),
    }),
  },
  presentation: {
    kind: "custom",
    renderPrompt: (queries, locale = "zh-CN") => {
      const state = queries.stateData() as { awakenedBeauty?: unknown } | null;
      return awakenedBeautyPromptState(readAwakenedBeautyStateData(state?.awakenedBeauty), locale);
    },
  },
};
