/**
 * 负责觉醒守卫精确原板的资料、严格空配置及运行贡献装配。输入原角色与已解析板子，
 * 输出唯一周期初始化、工具／夜阶段／验证与纯展示；资料和JSON工具不授保护或白天请求权。
 * 新awakened_protect明确区别既有觉醒隐狼awakened_guard工具，保持旧SDK参数契约。
 */
import { withArgumentVariants } from "../../engine/actions/argument-variants";
import { z } from "zod";
import { Role, Camp, Phase, RuleError, WinCondition } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_GUARD_POLICY,
  readAwakenedGuardStateData,
} from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import type { RoleContributions } from "../../rulesets/roles/contracts";
import { ownRoleCallback } from "../../rulesets/roles/owned-bindings";
import { ownedToolRules } from "../../engine/actions/validation-queries";
import { initializeAwakenedGuardState } from "./state";
import { guardActorChoiceAllowed } from "./authority";
import { AWAKENED_GUARD_PREPARE_STAGE, AWAKENED_GUARD_NIGHT_STAGE } from "./night-stage";
import { awakenedGuardPromptState } from "./presentation";
const parameters = z.strictObject({});
export const AWAKENED_GUARD_ROLE_PROFILE: RoleContributions = {
  metadata: {
    role: Role.AwakenedGuard,
    camp: Camp.Good,
    goodSide: "god",
    label: roleName("awakened_guard"),
    skillBrief: text("zh-CN", "role.awakened_guard.brief"),
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.Wolf,
      "awakened_wolf_beauty" as Role,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.AwakenedGuard,
      Role.AwakenedKnight,
    ],
  },
  runtime: {
    init: ownRoleCallback("init", {
      init: (role, ctx) => {
        if (!ctx.world) throw new Error("awakened_guard_world_required");
        initializeAwakenedGuardState(role, ctx.world);
      },
    }),
    configuration: {
      schema: parameters,
      defaults: {},
      apply: (c, v) => {
        parameters.parse(v);
        return { ...c, awakenedGuard: { policy: AWAKENED_GUARD_POLICY } };
      },
      serialize: () => ({}),
    },
    nightStages: [AWAKENED_GUARD_PREPARE_STAGE, AWAKENED_GUARD_NIGHT_STAGE],
    toolSpecs: [
      {
        name: "awakened_protect",
        ...withArgumentVariants(
          {
            type: "object",
            properties: {
              mode: { type: "string", enum: ["protect", "wait", "pass"] },
              target_id: { type: ["integer", "null"], minimum: 1 },
            },
            required: ["mode", "target_id"],
            additionalProperties: false,
          },
          [
            {
              properties: {
                mode: { type: "string", const: "protect" },
                target_id: { type: "integer", minimum: 1 },
              },
            },
            {
              properties: {
                mode: { type: "string", enum: ["wait", "pass"] },
                target_id: { type: "null" },
              },
            },
          ],
        ),
        argHint: 'awakened_protect args: {"mode":"protect"|"wait"|"pass","target_id":number|null}',
        userPromptHintKey: "action.awakened_protect.hint",
      },
    ],
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "awakened_protect",
        messageKey: "action.awakened_protect.directive",
        text: text("zh-CN", "action.awakened_protect.directive"),
      },
    ],
    validationRules: ownedToolRules({
      awakened_protect: ({ world, actorId, day, phase, toolCall }) =>
        [Phase.Night, Phase.Day, Phase.Voting].includes(phase) &&
        day !== undefined &&
        toolCall.name === "awakened_protect" &&
        guardActorChoiceAllowed(world, actorId, day, {
          mode: toolCall.args.mode,
          targetId: toolCall.args.target_id,
        })
          ? null
          : { code: RuleError.CustomRuleError },
    }),
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (_role, request) => {
        if (!request.allowedTools.includes("awakened_protect")) return null;
        const candidates = request.context.awakened_protect_options?.targetIds ?? [],
          target = candidates.includes(request.actorId) ? request.actorId : candidates[0];
        return target === undefined
          ? { name: "awakened_protect", args: { mode: "pass", target_id: null } }
          : { name: "awakened_protect", args: { mode: "protect", target_id: target } };
      },
    }),
  },
  presentation: {
    kind: "custom",
    renderPrompt: (q, locale = "zh-CN") =>
      awakenedGuardPromptState(
        readAwakenedGuardStateData(
          (q.stateData() as { awakenedGuard?: unknown } | null)?.awakenedGuard,
        ),
        locale,
      ),
  },
};
