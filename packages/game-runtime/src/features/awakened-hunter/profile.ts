/**
 * 负责觉醒猎人独立巡猎资料及有限板运行装配。输入严格空参数／原角色容器，输出唯一单位、N1原生命绑定和死亡钩子。
 * 不安装普通猎人枪、毒死限制或赠枪镜像；方向预检不是请求资格，真实原生命／临时patrol许可与付款由各实际owner复验。
 * 展示只接受脱离私态，真实死亡与胜负仍归引擎。
 */
import { z } from "zod";
import { Role, Camp, RuleError, WinCondition } from "@ai-werewolf-arena/game-contract";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import {
  AWAKENED_PATROL_POLICY,
  readAwakenedPatrolStateData,
} from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import type { RoleContributions } from "../../rulesets/roles/contracts";
import { ownRoleCallback } from "../../rulesets/roles/owned-bindings";
import { ownedToolRules } from "../../engine/actions/validation-queries";
import { initializeAwakenedPatrolState } from "./state";
import { patrolChoiceAllowed } from "./authority";
import { AWAKENED_PATROL_BIND_STAGE } from "./night-stage";
import { AWAKENED_PATROL_DEATH_HOOK } from "./death-hook";
import { awakenedPatrolPromptState } from "./presentation";
const parameters = z.strictObject({});
export const AWAKENED_PATROL_PROFILE: RoleContributions = {
  metadata: {
    role: Role.AwakenedHunter,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    label: roleName("awakened_hunter"),
    skillBrief: text("zh-CN", "role.awakened_hunter.brief"),
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.Guard,
      Role.AwakenedHunter,
      Role.AwakenedWolfBeauty,
    ],
  },
  runtime: {
    init: ownRoleCallback("init", { init: (role) => initializeAwakenedPatrolState(role) }),
    configuration: {
      schema: parameters,
      defaults: {},
      apply: (config, value) => {
        parameters.parse(value);
        return { ...config, awakenedHunter: { policy: AWAKENED_PATROL_POLICY } };
      },
      serialize: () => ({}),
    },
    toolSpecs: [
      {
        name: "patrol",
        parameters: {
          type: "object",
          properties: { direction: { enum: ["clockwise", "counter_clockwise", null] } },
          required: ["direction"],
          additionalProperties: false,
        },
        argHint: 'patrol args: {"direction":"clockwise"|"counter_clockwise"|null}',
        userPromptHintKey: "action.patrol.hint",
      },
    ],
    validationRules: ownedToolRules({
      patrol: (ctx) =>
        ctx.toolCall.name === "patrol" &&
        patrolChoiceAllowed(ctx.world, ctx.actorId, ctx.toolCall.args.direction)
          ? null
          : { code: RuleError.CustomRuleError },
    }),
    nightStages: [AWAKENED_PATROL_BIND_STAGE],
    deathHook: AWAKENED_PATROL_DEATH_HOOK,
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "patrol",
        messageKey: "action.patrol.directive",
        text: text("zh-CN", "action.patrol.directive"),
      },
    ],
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (_role, request) =>
        request.allowedTools.includes("patrol")
          ? { name: "patrol", args: { direction: "clockwise" } }
          : null,
    }),
  },
  presentation: {
    kind: "custom",
    renderPrompt: (queries, locale = "zh-CN") => {
      const state = queries.stateData() as { awakenedPatrol?: unknown } | null;
      return awakenedPatrolPromptState(readAwakenedPatrolStateData(state?.awakenedPatrol), locale);
    },
  },
};
