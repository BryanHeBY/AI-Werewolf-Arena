/**
 * 负责觉醒骑士精确原板资料、严格空配置、动作验证和纯展示。输入原角色与已解析板子，
 * 输出唯一attempts初始化和贡献；不复用普通骑士canDuel、不授死亡权限或在profile推进日流程。
 * 普通／连续窗口的null含义由实际请求声明，候选名单不泄露Camp。
 */
import { z } from "zod";
import { Role, Camp, Phase, RuleError, WinCondition } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_DUEL_POLICY,
  readAwakenedKnightStateData,
} from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import type { RoleContributions } from "../../rulesets/roles/contracts";
import { ownRoleCallback } from "../../rulesets/roles/owned-bindings";
import { ownedToolRules } from "../../engine/actions/validation-queries";
import { initializeAwakenedKnightState } from "./state";
import { duelActorChoiceAllowed } from "./authority";
import { awakenedKnightPromptState } from "./presentation";
import { AWAKENED_KNIGHT_PREPARE_STAGE } from "./night-stage";
const parameters = z.strictObject({});
export const AWAKENED_KNIGHT_ROLE_PROFILE: RoleContributions = {
  metadata: {
    role: Role.AwakenedKnight,
    camp: Camp.Good,
    goodSide: "god",
    label: roleName("awakened_knight"),
    skillBrief: text("zh-CN", "role.awakened_knight.brief"),
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
    nightStages: [AWAKENED_KNIGHT_PREPARE_STAGE],
    init: ownRoleCallback("init", {
      init: (role, ctx) => {
        if (!ctx.world) throw new Error("awakened_knight_world_required");
        initializeAwakenedKnightState(role, ctx.world);
      },
    }),
    configuration: {
      schema: parameters,
      defaults: {},
      apply: (c, v) => {
        parameters.parse(v);
        return { ...c, awakenedKnight: { policy: AWAKENED_DUEL_POLICY } };
      },
      serialize: () => ({}),
    },
    toolSpecs: [
      {
        name: "awakened_duel",
        parameters: {
          type: "object",
          properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'awakened_duel args: {"target_id":number|null}',
        userPromptHintKey: "action.awakened_duel.hint",
      },
    ],
    stageDirectives: [
      {
        match: (tools) => tools.length === 1 && tools[0] === "awakened_duel",
        messageKey: "action.awakened_duel.directive",
        text: text("zh-CN", "action.awakened_duel.directive"),
      },
    ],
    validationRules: ownedToolRules({
      awakened_duel: ({ world, actorId, day, phase, toolCall }) =>
        [Phase.Day, Phase.Voting].includes(phase) &&
        day !== undefined &&
        toolCall.name === "awakened_duel" &&
        duelActorChoiceAllowed(world, actorId, day, toolCall.args.target_id)
          ? null
          : { code: RuleError.CustomRuleError },
    }),
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (_role, request) =>
        request.allowedTools.includes("awakened_duel")
          ? {
              name: "awakened_duel",
              args: { target_id: request.context.awakened_duel_options?.targetIds[0] ?? null },
            }
          : null,
    }),
  },
  presentation: {
    kind: "custom",
    renderPrompt: (q, locale = "zh-CN") =>
      awakenedKnightPromptState(
        readAwakenedKnightStateData(
          (q.stateData() as { awakenedKnight?: unknown } | null)?.awakenedKnight,
        ),
        locale,
      ),
  },
};
