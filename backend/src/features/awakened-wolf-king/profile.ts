/**
 * 负责觉醒狼王有限版本的资料、配置与实际能力装配。普通狼队贡献保留原引用，双爪库存只由本族安装。
 * 输入为公开板子和角色初始化上下文，输出唯一资源、亲传夜窗与死亡动作贡献；资料／展示不授予许可。
 * 展示使用脱离数据的本族纯函数，新增角色不加入中央原生捕获分派。
 */
import { z } from "zod";
import { Role, Phase, WinCondition, RuleError } from "@ai-werewolf-arena/game-contract";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import {
  AWAKENED_CLAW_POLICY,
  readAwakenedClawStateData,
} from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import { ownRoleCallback, roleMethod } from "../../rulesets/roles/owned-bindings";
import type { RoleContributions } from "../../rulesets/roles/contracts";
import { ownedToolRules } from "../../engine/actions/validation-queries";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { DEATH_SHOT_TOOL_SPECS, DEATH_SHOT_REPAIR } from "../death-actions/tool-ports";
import { installAwakenedClaws, createNativeClaws } from "./state";
import { AWAKENED_CLAW_DEATH_HOOK } from "./death-hook";
import { AWAKENED_CLAW_BEQUEST_STAGE } from "./night-stage";
import { clawBequestAllowed } from "./bequest-authority";
import { awakenedClawPromptState } from "./presentation";
const parameters = z.strictObject({});
export const AWAKENED_WOLF_KING_PROFILE: RoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    role: Role.AwakenedWolfKing,
    label: roleName("awakened_wolf_king"),
    skillBrief: text("zh-CN", "role.awakened_wolf_king.brief"),
    maxCount: 1,
    supportedWinConditions: [WinCondition.SlaughterSide],
    supportedBoardRoles: [
      Role.AwakenedWolfKing,
      Role.Wolf,
      Role.Villager,
      Role.Seer,
      Role.Witch,
      Role.MiracleMerchant,
      Role.Dreamer,
      Role.Guard,
      Role.Hunter,
      Role.AwakenedWitch,
    ],
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    init: ownRoleCallback("init", {
      init: (role, ctx) => installAwakenedClaws(role, createNativeClaws(), ctx.world),
    }),
    configuration: {
      schema: parameters,
      defaults: {},
      apply: (config, value) => {
        parameters.parse(value);
        return { ...config, awakenedWolfKing: { policy: AWAKENED_CLAW_POLICY } };
      },
      serialize: () => ({}),
    },
    toolSpecs: [
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs!,
      ...DEATH_SHOT_TOOL_SPECS,
      {
        name: "bequeath_claw",
        parameters: {
          type: "object",
          properties: { target_id: { type: ["integer", "null"], minimum: 1 } },
          required: ["target_id"],
          additionalProperties: false,
        },
        argHint: 'bequeath_claw args: {"target_id":number|null}',
        userPromptHintKey: "action.bequeath_claw.hint",
      },
    ],
    validationRules: ownedToolRules({
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      shoot: () => ({ code: RuleError.ShootUnavailable }),
      bequeath_claw: (ctx) =>
        ctx.phase === Phase.Night &&
        ctx.day !== undefined &&
        ctx.toolCall.name === "bequeath_claw" &&
        clawBequestAllowed(ctx.world, ctx.actorId, ctx.day, ctx.toolCall.args.target_id)
          ? null
          : { code: RuleError.CustomRuleError },
    }),
    stageDirectives: [
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.stageDirectives!,
      {
        match: (tools) => tools.length === 1 && tools[0] === "bequeath_claw",
        messageKey: "action.bequeath_claw.directive",
        text: text("zh-CN", "action.bequeath_claw.directive"),
      },
    ],
    nightStages: [...ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages!, AWAKENED_CLAW_BEQUEST_STAGE],
    deathHook: AWAKENED_CLAW_DEATH_HOOK,
    llmRepair: {
      coerce: {
        ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.llmRepair?.coerce,
        ...DEATH_SHOT_REPAIR.coerce,
        bequeath_claw: (args) =>
          args.target_id === null
            ? { target_id: null }
            : typeof args.target_id === "number" &&
                Number.isSafeInteger(args.target_id) &&
                args.target_id > 0
              ? { target_id: args.target_id }
              : null,
      },
    },
    baselineAction: ownRoleCallback("baselineAction", {
      baselineAction: (role, request, pick, camp, locale, world, currentCamp) => {
        if (request.allowedTools.includes("bequeath_claw"))
          return {
            name: "bequeath_claw",
            args: { target_id: request.context.claw_bequest_candidates?.[0] ?? null },
          };
        if (request.allowedTools.includes("shoot"))
          return { name: "shoot", args: { target_id: camp("good") ?? pick() } };
        return roleMethod(ORDINARY_WOLF_CONTRIBUTIONS.runtime, "baselineAction")!(
          role,
          request,
          pick,
          camp,
          locale,
          world,
          currentCamp,
        );
      },
    }),
  },
  presentation: {
    kind: "custom",
    renderPrompt: (queries, locale = "zh-CN") => {
      const value = queries.stateData() as { awakenedClaws?: unknown } | null;
      return awakenedClawPromptState(readAwakenedClawStateData(value?.awakenedClaws), locale);
    },
  },
};
