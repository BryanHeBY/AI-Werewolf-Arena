import { z } from "zod";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Camp, Role, Phase } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { isAliveTarget } from "../../validation/contracts";
import { numberOrNull } from "../../llm/helpers";
import { getMerchantState, freshMerchantState, setMerchantState, projectMerchantState, canMerchantTrade } from "./state";
import { MIRACLE_MERCHANT_STAGE } from "./night_stage";
import { LUCKY_ABILITY_STAGE } from "./lucky_stage";

export const MIRACLE_MERCHANT_ROLE_PROFILE: RoleProfile = {
  role: Role.MiracleMerchant, camp: Camp.Good, goodSide: "god", maxCount: 1,
  label: roleName("miracle_merchant"), skillBrief: text("zh-CN", "role.miracle_merchant.brief"),
  supportedBoardRoles: [Role.MiracleMerchant,Role.Wolf,Role.WolfKing,Role.HiddenWolf,Role.Seer,Role.Witch,Role.Guard,Role.Hunter,Role.Dreamer,Role.Villager],
  init: role => { if (!getMerchantState(role)) setMerchantState(role, freshMerchantState()); },
  renderPrompt: (role,locale="zh-CN") => text(locale,"role.miracle_merchant.state") + " " + text(locale,"role.miracle_merchant.status",{state:JSON.stringify(projectMerchantState(getMerchantState(role)!))}),
  configuration: { schema:z.strictObject({}),defaults:{},apply:config=>config },
  nightStages: [MIRACLE_MERCHANT_STAGE,LUCKY_ABILITY_STAGE], possibleNightAbilities:["seer_check","potion","guard"],
  toolSpecs: [{name:"bestow_ability",llm:{name:"bestow_ability",description:"Choose another living player and one Miracle Merchant skill, once per game. Your true role and faction remain unchanged.",parameters:{type:"object",properties:{target_id:{type:"integer"},skill:{type:"string",enum:["check","poison","guard"]}},required:["target_id","skill"],additionalProperties:false}},argHint:'bestow_ability args: {"target_id":number,"skill":"check"|"poison"|"guard"}',userPromptHintKey:"action.bestow_ability.hint"}],
  validationRules: {bestow_ability:({world,actorId,role,day,phase,toolCall})=>{
    const state=getMerchantState(role);
    if(role.role!==Role.MiracleMerchant||role.camp!==Camp.Good||!state||day===undefined||!canMerchantTrade(state,day))return{code:RuleError.MerchantUnavailable};
    if(phase!==Phase.Night)return{code:RuleError.AbilityPhase};
    if(toolCall.name!=="bestow_ability")return{code:RuleError.ToolMismatch};
    if(!["check","poison","guard"].includes(toolCall.args.skill))return{code:RuleError.MerchantSkill};
    if(toolCall.args.target_id===actorId||!isAliveTarget(world,toolCall.args.target_id))return{code:RuleError.MerchantTarget};
    return null;
  }},
  llmRepair:{coerce:{bestow_ability:args=>{const target=numberOrNull(args.target_id);return target===null?null:{target_id:target,skill:args.skill};}}},
  baselineAction:(_role,request,pick)=>{
    if(!request.allowedTools.includes("bestow_ability"))return null;
    const target=pick();return target===null?null:{name:"bestow_ability",args:{target_id:target,skill:"check"}};
  },
};
