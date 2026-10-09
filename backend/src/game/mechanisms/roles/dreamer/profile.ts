import {z} from "zod";
import {RuleError} from "@ai-werewolf-arena/game-catalog";
import {text,roleName} from "@ai-werewolf-arena/game-text";
import {Camp,Role,Phase} from "../../../../core/domain/model";
import type {RoleProfile} from "../contracts";
import {activeNightAbility} from "../abilities";
import {getDreamerState,setDreamerState} from "../private_state";
import {isAliveTarget} from "../../validation/contracts";
import {numberOrNull} from "../../llm/helpers";
import {DREAMER_NIGHT_STAGE} from "./night_stages";

export const DREAMER_ROLE_PROFILE:RoleProfile={
  role:Role.Dreamer,camp:Camp.Good,goodSide:"god",label:roleName("dreamer"),skillBrief:text("zh-CN","role.dreamer.brief"),
  init:role=>{setDreamerState(role,{lastTarget:null,lastDay:null,history:[]});},
  renderPrompt:(role,locale="zh-CN")=>{const state=getDreamerState(role);return text(locale,"role.dreamer.state")+(state?.lastTarget!==null&&state?.lastTarget!==undefined&&state.lastDay!==null?" "+text(locale,"role.dreamer.latest",{target:state.lastTarget,day:state.lastDay}):"");},
  configuration:{schema:z.strictObject({}),defaults:{},apply:config=>config,serialize:()=>({})},
  nightStages:[DREAMER_NIGHT_STAGE],
  toolSpecs:[{name:"dream",llm:{name:"dream",description:"Choose another living player as this night's sleepwalker. A target is required.",parameters:{type:"object",properties:{target_id:{type:"number"}},required:["target_id"],additionalProperties:false}},argHint:'dream args: {"target_id":number}',userPromptHintKey:"action.dream.hint"}],
  validationRules:{dream:({world,actorId,role,toolCall,phase,day,abilityId})=>{
    if(!activeNightAbility(role,"dream",day??1,abilityId))return{code:RuleError.DreamUnavailable};
    if(phase!==Phase.Night)return{code:RuleError.AbilityPhase};
    if(toolCall.name!=="dream"||toolCall.args.target_id===actorId||!isAliveTarget(world,toolCall.args.target_id))return{code:RuleError.DreamTarget};
    return null;
  }},
  stageDirectives:[{match:tools=>tools.length===1&&tools[0]==="dream",messageKey:"action.dream.directive",text:text("zh-CN","action.dream.directive")}],
  llmRepair:{coerce:{dream:args=>{const target=numberOrNull(args.target_id);return target===null?null:{target_id:target};}}},
  baselineAction:(_role,request,pick)=>{if(!request.allowedTools.includes("dream"))return null;const target=pick();return target===null?null:{name:"dream",args:{target_id:target}};},
};
