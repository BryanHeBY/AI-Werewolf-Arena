import {z} from "zod";
import {roleName,text} from "@ai-werewolf-arena/game-text";
import {Camp,Role} from "../../../../core/domain/model";
import type {RoleProfile} from "../contracts";
import {getBearState,setBearState} from "../private_state";

export const BEAR_ROLE_PROFILE:RoleProfile={
 role:Role.Bear,camp:Camp.Good,goodSide:"god",maxCount:1,label:roleName("bear"),skillBrief:text("zh-CN","role.bear.brief"),
 init:role=>{setBearState(role,{history:[]});},
 renderPrompt:(role,locale="zh-CN")=>{
  const report=getBearState(role)?.history.at(-1);
  return text(locale,"role.bear.state")+" "+(report?text(locale,"role.bear.latest",{day:report.day,result:text(locale,report.roared?"bear.roar":"bear.quiet")}):text(locale,"role.bear.no_report"));
 },
 configuration:{schema:z.strictObject({}),defaults:{},apply:config=>config,serialize:()=>({})},
};
