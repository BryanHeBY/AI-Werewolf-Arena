/**
 * 负责典狱长有限原十二人角色贡献。复用同一普通狼聊天、刀票、自爆与团队能力，
 * 增加独立秘密交易工具；初始资源只装一个不可变历史槽，不赠送第二份个人能力。
 * 展示只消费脱离值，实际pair、决定与原体授权始终归本族authority。
 * 输入为具名政策与原普通狼贡献，输出本族metadata/runtime和纯值presentation；不在登记时付款或发布事实。
 */
import { z } from "zod";
import { Role, Camp, Phase, RuleError, WinCondition } from "@ai-werewolf-arena/game-contract";
import {
  WARDEN_POLICY,
  WARDEN_FORCE_POLICY,
  readWardenStateData,
} from "@ai-werewolf-arena/game-contract/facts/warden";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import type { RoleContributions } from "../../rulesets/roles/contracts";
import { invokeRoleCallback, ownRoleCallback } from "../../rulesets/roles/owned-bindings";
import { ownedToolRules } from "../../engine/actions/validation-queries";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { initializeWardenState } from "./state";
import { wardenPairAllowed, wardenDecisionCurrent } from "./authority";
import { WARDEN_NIGHT_STAGE } from "./night-stage";
import { wardenPromptState } from "./presentation";
const parameters = z.strictObject({
  policy: z.literal(WARDEN_POLICY).default(WARDEN_POLICY),
  forcePolicy: z.literal(WARDEN_FORCE_POLICY).default(WARDEN_FORCE_POLICY),
});
export const WARDEN_ROLE_PROFILE: RoleContributions = {
  metadata: {
    role: Role.Warden,
    camp: Camp.Wolf,
    label: roleName("warden"),
    skillBrief: text("zh-CN", "role.warden.brief"),
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Hunter,
      Role.Dreamer,
      Role.Warden,
    ],
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    init: ownRoleCallback("init", { init: initializeWardenState }),
    configuration: {
      schema: parameters,
      defaults: { policy: WARDEN_POLICY, forcePolicy: WARDEN_FORCE_POLICY },
      apply: (c, v) => ({ ...c, warden: parameters.parse(v) }),
      serialize: (c) => parameters.parse(c.warden ?? {}),
    },
    nightStages: [...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages ?? []), WARDEN_NIGHT_STAGE],
    toolSpecs: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs ?? []),
      {
        name: "warden_pair",
        parameters: {
          type: "object",
          properties: {
            target_ids: {
              anyOf: [
                {
                  type: "array",
                  items: { type: "integer", minimum: 1 },
                  minItems: 2,
                  maxItems: 2,
                  uniqueItems: true,
                },
                { type: "null" },
              ],
            },
          },
          required: ["target_ids"],
          additionalProperties: false,
        },
        argHint: 'warden_pair args: {"target_ids":[number,number]|null}',
        userPromptHintKey: "action.warden_pair.hint",
      },
      {
        name: "warden_decide",
        parameters: {
          type: "object",
          properties: { choice: { type: "string", enum: ["trade", "betray"] } },
          required: ["choice"],
          additionalProperties: false,
        },
        argHint: 'warden_decide args: {"choice":"trade"|"betray"}',
        userPromptHintKey: "action.warden_decide.hint",
      },
    ],
    stageDirectives: [
      ...(ORDINARY_WOLF_CONTRIBUTIONS.runtime.stageDirectives ?? []),
      {
        match: (t) => t.length === 1 && t[0] === "warden_pair",
        messageKey: "action.warden_pair.directive",
        text: text("zh-CN", "action.warden_pair.directive"),
      },
      {
        match: (t) => t.length === 1 && t[0] === "warden_decide",
        messageKey: "action.warden_decide.directive",
        text: text("zh-CN", "action.warden_decide.directive"),
      },
    ],
    validationRules: {
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      ...ownedToolRules({
        warden_pair: ({ world, actorId, day, phase, toolCall }) =>
          phase === Phase.Night &&
          day !== undefined &&
          toolCall.name === "warden_pair" &&
          wardenPairAllowed(world, actorId, day, toolCall.args.target_ids)
            ? null
            : { code: RuleError.CustomRuleError },
        warden_decide: ({ world, actorId, day, phase, toolCall }) =>
          phase === Phase.Night &&
          day !== undefined &&
          toolCall.name === "warden_decide" &&
          (toolCall.args.choice === "trade" || toolCall.args.choice === "betray") &&
          wardenDecisionCurrent(world, actorId, day)
            ? null
            : { code: RuleError.CustomRuleError },
      }),
    },
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (role, request, pick, camp, locale, world, source) => {
        if (request.allowedTools.includes("warden_pair")) {
          const c = request.context.warden_candidates ?? [];
          return {
            name: "warden_pair",
            args: { target_ids: c.length >= 2 ? [c[0]!, c[1]!] : null },
          };
        }
        if (request.allowedTools.includes("warden_decide"))
          return { name: "warden_decide", args: { choice: "trade" } };
        const baseline = ORDINARY_WOLF_CONTRIBUTIONS.runtime.baselineAction;
        return baseline
          ? invokeRoleCallback(
              "baselineAction",
              baseline,
              ORDINARY_WOLF_CONTRIBUTIONS.runtime,
              role,
              request,
              pick,
              camp,
              locale,
              world,
              source,
            )
          : null;
      },
    }),
  },
  presentation: {
    kind: "custom",
    renderPrompt: (q, locale = "zh-CN") => {
      const value = q.stateData() as { warden?: unknown } | null;
      return wardenPromptState(readWardenStateData(value?.warden), locale);
    },
  },
};
