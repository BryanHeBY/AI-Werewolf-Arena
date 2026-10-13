/**
 * 负责 黑市商人 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Camp, Role, Phase } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";
import {
  getBlackMarketState,
  freshBlackMarketState,
  setBlackMarketState,
  projectBlackMarketState,
  canBlackMarketTrade,
} from "./state";
import { BLACK_MARKET_TRADE_STAGE, BLACK_MARKET_RECIPIENT_STAGE } from "./night_stage";
export const BLACK_MARKET_MERCHANT_ROLE_PROFILE: RoleProfile = {
  role: Role.BlackMarketMerchant,
  camp: Camp.Good,
  goodSide: "god",
  maxCount: 1,
  label: roleName("black_market_merchant"),
  skillBrief: text("zh-CN", "role.black_market_merchant.brief"),
  supportedBoardRoles: [
    Role.BlackMarketMerchant,
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
  init: (role) => {
    if (!getBlackMarketState(role)) setBlackMarketState(role, freshBlackMarketState());
  },
  ...nativeRolePresentation("black_market_merchant"),
  configuration: {
    schema: z.strictObject({}),
    defaults: {},
    apply: (config) => config,
    serialize: () => ({}),
  },
  nightStages: [BLACK_MARKET_TRADE_STAGE, BLACK_MARKET_RECIPIENT_STAGE],
  possibleNightAbilities: ["seer_check", "potion"],
  possibleDeathAbilities: ["gun"],
  toolSpecs: [
    {
      name: "black_market_trade",
      parameters: {
        type: "object",
        properties: {
          target_id: { type: "integer", minimum: 1 },
          skill: { type: "string", enum: ["check", "poison", "gun"] },
        },
        required: ["target_id", "skill"],
        additionalProperties: false,
      },
      argHint: 'black_market_trade args: {"target_id":number,"skill":"check"|"poison"|"gun"}',
      userPromptHintKey: "action.black_market_trade.hint",
    },
  ],
  validationRules: {
    black_market_trade: ({ world, actorId, role, day, phase, toolCall }) => {
      const state = getBlackMarketState(role);
      if (
        role.role !== Role.BlackMarketMerchant ||
        role.camp !== Camp.Good ||
        !state ||
        day === undefined ||
        !canBlackMarketTrade(state, day)
      )
        return { code: RuleError.MerchantUnavailable };
      if (phase !== Phase.Night) return { code: RuleError.AbilityPhase };
      if (toolCall.name !== "black_market_trade") return { code: RuleError.ToolMismatch };
      if (!["check", "poison", "gun"].includes(toolCall.args.skill))
        return { code: RuleError.BlackMarketSkill };
      if (
        !Number.isSafeInteger(toolCall.args.target_id) ||
        toolCall.args.target_id === actorId ||
        !isAliveTarget(world, toolCall.args.target_id)
      )
        return { code: RuleError.MerchantTarget };
      return null;
    },
  },
  llmRepair: {
    coerce: {
      black_market_trade: (args) => {
        const target = numberOrNull(args.target_id);
        return target === null ? null : { target_id: target, skill: args.skill };
      },
    },
  },
  baselineAction: (_role, request, pick) => {
    if (!request.allowedTools.includes("black_market_trade")) return null;
    const target = pick();
    return target === null
      ? null
      : { name: "black_market_trade", args: { target_id: target, skill: "check" } };
  },
};
