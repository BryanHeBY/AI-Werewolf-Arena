import {z} from "zod";
import {roleName,text,inspectionLabel} from "@ai-werewolf-arena/game-text";
import {Role} from "../../../../core/domain/model";
import type {RoleProfile} from "../contracts";
import {getGargoyleState,setGargoyleState,getRoleInspectionState,setRoleInspectionState} from "../private_state";
import {WOLF_ROLE_PROFILE} from "../wolf/profile";
import {numberOrNull} from "../../llm/helpers";
import {canGargoyleKnife} from "./inheritance";
import {ROLE_INSPECTION_STAGE} from "../role_inspection/night_stages";

import {ROLE_INSPECTION_TOOL,validateRoleInspection,roleInspectionTargets} from "../role_inspection/rules";

export const GARGOYLE_ROLE_PROFILE:RoleProfile={
 ...WOLF_ROLE_PROFILE,role:Role.Gargoyle,maxCount:1,canSelfDestruct:false,label:roleName("gargoyle"),skillBrief:text("zh-CN","role.gargoyle.brief"),
 init:role=>{setGargoyleState(role,{hasInheritedKnife:false});setRoleInspectionState(role,{lastTarget:null,lastDay:null,history:[]});},
 wolfTeam:(role,world)=>({recognizedByPack:false,recognizes:"none",canChat:false,canVoteForKill:canGargoyleKnife(role,world)}),
 renderPrompt:(role,locale="zh-CN",world)=>{const report=getRoleInspectionState(role)?.history.at(-1);return text(locale,"role.gargoyle.state")+" "+text(locale,"role.gargoyle.status",{inherited:text(locale,getGargoyleState(role)?.hasInheritedKnife===true?"common.yes":"common.no"),active:text(locale,canGargoyleKnife(role,world)?"common.yes":"common.no")})+(report?" "+text(locale,"inspection.latest",{target:report.targetId,result:inspectionLabel(report.result,locale)}):"");},
 configuration:{schema:z.strictObject({}),defaults:{},apply:config=>config},
 nightStages:[ROLE_INSPECTION_STAGE,...WOLF_ROLE_PROFILE.nightStages!],possibleNightAbilities:["role_check"],
 toolSpecs:[...WOLF_ROLE_PROFILE.toolSpecs!.filter(spec=>spec.name==="kill_vote"),ROLE_INSPECTION_TOOL],
 validationRules:{...WOLF_ROLE_PROFILE.validationRules,inspect_role:validateRoleInspection},
 llmRepair:{coerce:{...WOLF_ROLE_PROFILE.llmRepair?.coerce,inspect_role:args=>{const target=numberOrNull(args.target_id);return target===null?null:{target_id:target};}}},
 baselineAction:(role,request,pick,byCamp,locale,world)=>{if(request.allowedTools.includes("inspect_role")){const state=getRoleInspectionState(role,request.context.ability_id),target=world&&state?roleInspectionTargets(world,request.actorId,state)[0]:null;return target===null||target===undefined?null:{name:"inspect_role",args:{target_id:target}};}return WOLF_ROLE_PROFILE.baselineAction!(role,request,pick,byCamp,locale,world);},
};
