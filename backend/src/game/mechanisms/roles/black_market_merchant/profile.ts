import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Camp, Role, Phase } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";
import { getBlackMarketState, freshBlackMarketState, setBlackMarketState, projectBlackMarketState, canBlackMarketTrade } from "./state";
import { BLACK_MARKET_TRADE_STAGE, BLACK_MARKET_RECIPIENT_STAGE } from "./night_stage";
export const BLACK_MARKET_MERCHANT_ROLE_PROFILE: RoleProfile = {
  role: Role.BlackMarketMerchant, camp: Camp.Good, goodSide: "god", maxCount: 1,
  label: roleName("black_market_merchant"), skillBrief: text("zh-CN", "role.black_market_merchant.brief"),
  supportedBoardRoles: [Role.BlackMarketMerchant, Role.Wolf, Role.WolfKing, Role.HiddenWolf, Role.Seer, Role.Witch, Role.Guard, Role.Hunter, Role.Dreamer, Role.Villager],
  init: role => { if (!getBlackMarketState(role)) setBlackMarketState(role, freshBlackMarketState()); },
  renderPrompt: (role, locale = "zh-CN") => text(locale, "role.black_market_merchant.state") + " " + text(locale, "role.black_market_merchant.status", { state: JSON.stringify(projectBlackMarketState(getBlackMarketState(role)!)) }),
  configuration: { schema: z.strictObject({}), defaults: {}, apply: config => config, serialize: () => ({}) },
  nightStages: [BLACK_MARKET_TRADE_STAGE, BLACK_MARKET_RECIPIENT_STAGE], possibleNightAbilities: ["seer_check", "potion"], possibleDeathAbilities: ["gun"],
  toolSpecs: [{ name: "black_market_trade", llm: { name: "black_market_trade", description: "Choose another living player and one Black Market gift, once per game.", parameters: { type: "object", properties: { target_id: { type: "integer", minimum: 1 }, skill: { type: "string", enum: ["check", "poison", "gun"] } }, required: ["target_id", "skill"], additionalProperties: false } }, argHint: 'black_market_trade args: {"target_id":number,"skill":"check"|"poison"|"gun"}', userPromptHintKey: "action.black_market_trade.hint" }],
  validationRules: { black_market_trade: ({ world, actorId, role, day, phase, toolCall }) => {
    const state = getBlackMarketState(role); if (role.role !== Role.BlackMarketMerchant || role.camp !== Camp.Good || !state || day === undefined || !canBlackMarketTrade(state, day)) return { code: RuleError.MerchantUnavailable };
    if (phase !== Phase.Night) return { code: RuleError.AbilityPhase }; if (toolCall.name !== "black_market_trade") return { code: RuleError.ToolMismatch };
    if (!["check", "poison", "gun"].includes(toolCall.args.skill)) return { code: RuleError.BlackMarketSkill };
    if (!Number.isSafeInteger(toolCall.args.target_id) || toolCall.args.target_id === actorId || !isAliveTarget(world, toolCall.args.target_id)) return { code: RuleError.MerchantTarget }; return null;
  } },
  llmRepair: { coerce: { black_market_trade: args => { const target = numberOrNull(args.target_id); return target === null ? null : { target_id: target, skill: args.skill }; } } },
  baselineAction: (_role, request, pick) => { if (!request.allowedTools.includes("black_market_trade")) return null; const target = pick(); return target === null ? null : { name: "black_market_trade", args: { target_id: target, skill: "check" } }; },
};
