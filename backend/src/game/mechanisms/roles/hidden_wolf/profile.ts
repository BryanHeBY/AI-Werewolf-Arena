import {z} from "zod";
import {roleName,text} from "@ai-werewolf-arena/game-text";
import {Camp,Role} from "../../../../core/domain/model";
import type {RoleProfile} from "../contracts";
import {getHiddenWolfState,setHiddenWolfState} from "../private_state";
import {WOLF_ROLE_PROFILE} from "../wolf/profile";
import {canHiddenWolfKnife} from "./inheritance";

export const HIDDEN_WOLF_ROLE_PROFILE:RoleProfile={
 ...WOLF_ROLE_PROFILE,role:Role.HiddenWolf,maxCount:1,canSelfDestruct:false,label:roleName("hidden_wolf"),skillBrief:text("zh-CN","role.hidden_wolf.brief"),
 init:role=>{setHiddenWolfState(role,{hasInheritedKnife:false});},
 wolfTeam:(role,world)=>({recognizedByPack:false,recognizes:"all",canChat:false,canVoteForKill:canHiddenWolfKnife(role,world)}),
 inspectionLabels:role=>getHiddenWolfState(role)?.hasInheritedKnife===true?{camp:Camp.Wolf,role:Role.HiddenWolf}:{camp:Camp.Good,role:Role.Villager},
 detectableByBear:(_world,role)=>getHiddenWolfState(role)?.hasInheritedKnife===true,
 renderPrompt:(role,locale="zh-CN",world)=>text(locale,"role.hidden_wolf.state")+" "+text(locale,"role.hidden_wolf.status",{inherited:text(locale,getHiddenWolfState(role)?.hasInheritedKnife===true?"common.yes":"common.no"),active:text(locale,canHiddenWolfKnife(role,world)?"common.yes":"common.no")}),
 configuration:{schema:z.strictObject({}),defaults:{},apply:config=>config,serialize:()=>({})},
 toolSpecs:WOLF_ROLE_PROFILE.toolSpecs!.filter(spec=>spec.name==="kill_vote"),
};
