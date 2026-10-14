/**
 * 负责 奇迹商人 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import { isRoleExecutionRetired } from "../../../../core/domain/role-execution-authority";
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Camp, Role, Phase } from "../../../../core/domain/model";
import type { NativeRoleContributions } from "../contracts";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";
import {
  getMerchantState,
  freshMerchantState,
  setMerchantState,
  projectMerchantState,
  canMerchantTrade,
} from "./state";
import { MIRACLE_MERCHANT_STAGE } from "./night_stage";
import { LUCKY_ABILITY_STAGE } from "./lucky_stage";

export const MIRACLE_MERCHANT_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    role: Role.MiracleMerchant,
    camp: Camp.Good,
    goodSide: "god",
    maxCount: 1,
    label: roleName("miracle_merchant"),
    skillBrief: text("zh-CN", "role.miracle_merchant.brief"),
    supportedBoardRoles: [
      Role.CursedFox,
      Role.MiracleMerchant,
      Role.Wolf,
      Role.WolfKing,
      Role.HiddenWolf,
      Role.Seer,
      Role.Witch,
      Role.Guard,
      Role.Hunter,
      Role.Dreamer,
      Role.Villager,
    ],
  },
  runtime: {
    init: (role) => {
      if (!getMerchantState(role)) setMerchantState(role, freshMerchantState());
    },
    configuration: {
      schema: z.strictObject({}),
      defaults: {},
      apply: (config) => config,
      serialize: () => ({}),
    },
    nightStages: [MIRACLE_MERCHANT_STAGE, LUCKY_ABILITY_STAGE],
    possibleNightAbilities: ["seer_check", "potion", "guard"],
    toolSpecs: [
      {
        name: "bestow_ability",
        parameters: {
          type: "object",
          properties: {
            target_id: { type: "integer" },
            skill: { type: "string", enum: ["check", "poison", "guard"] },
          },
          required: ["target_id", "skill"],
          additionalProperties: false,
        },
        argHint: 'bestow_ability args: {"target_id":number,"skill":"check"|"poison"|"guard"}',
        userPromptHintKey: "action.bestow_ability.hint",
      },
    ],
    validationRules: {
      bestow_ability: ({ world, actorId, role, day, phase, toolCall }) => {
        const state = getMerchantState(role);
        if (
          role.role !== Role.MiracleMerchant ||
          world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Good ||
          !state ||
          day === undefined ||
          !canMerchantTrade(state, day)
        )
          return { code: RuleError.MerchantUnavailable };
        if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
        if (toolCall.name !== "bestow_ability") return { code: RuleError.ToolMismatch };
        if (!["check", "poison", "guard"].includes(toolCall.args.skill))
          return { code: RuleError.MerchantSkill };
        if (toolCall.args.target_id === actorId || !isAliveTarget(world, toolCall.args.target_id))
          return { code: RuleError.MerchantTarget };
        // 原阶段、工具、技能与目标校验先完整执行；只在原成功尾拒绝新动作，不改原错误优先级。
        if (isRoleExecutionRetired(role)) return { code: RuleError.MerchantUnavailable };
        return null;
      },
    },
    llmRepair: {
      coerce: {
        bestow_ability: (args) => {
          const target = numberOrNull(args.target_id);
          return target === null ? null : { target_id: target, skill: args.skill };
        },
      },
    },
    baselineAction: (_role, request, pick) => {
      if (!request.allowedTools.includes("bestow_ability")) return null;
      const target = pick();
      return target === null
        ? null
        : { name: "bestow_ability", args: { target_id: target, skill: "check" } };
    },
  },
  presentation: nativeRolePresentation("miracle_merchant"),
};
