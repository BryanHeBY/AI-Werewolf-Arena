import { ActionWindow, PotionType, Role, WinCondition } from "../../src/core";
import { boardDefinitionFromConfig, parseBoardDefinition } from "../../src/runtime/config/board_definition";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../src/runtime/scenarios/twelve_player_standard";
import { foundationTransportPlan, type PlannedTurn } from "./foundation_transport_plan";
import type { TransportGameScenario } from "./run_transport_game";

export type WhiteWolfScenario = "hunter" | PotionType.None | "pending_poison" | "pending_knife" | "wolf_king" | "twelve";
const whiteAction = (target_id:number|null) => ({name:"self_destruct_with_target" as const,args:{reason:"Chosen public action",confirm:true,target_id}});
function oracle(scenario:TransportGameScenario):TransportGameScenario {
 return {...scenario,promptAssertions:(actor,locale)=>scenario.roles[actor-1]===Role.WhiteWolfKing?{
  expectedIdentityMarker:locale==="en"?"your true role is White Wolf King.":"真实身份是白狼王。",
  requiredCurrentMarkers:locale==="en"?["Your role is White Wolf King.","Self-destruct opportunities remaining: 1."]:["你的底牌是【白狼王】","自爆机会剩余：1。"],
 }:{forbiddenCurrentMarkers:[locale==="en"?"Self-destruct opportunities remaining:":"自爆机会剩余："]}};
}
export function whiteWolfScenario(kind:WhiteWolfScenario, window:ActionWindow=ActionWindow.OnPreVote):TransportGameScenario {
 if(kind==="twelve") {
  const turns=foundationTransportPlan(12);
  for(const [actor,rows] of turns) turns.set(actor,rows.filter(row=>!(row.day===1&&(row.stage==="voting"||row.stage==="last_words"))&&!(actor===10&&row.day===2)&&!(actor===2&&row.day===2)));
  turns.get(2)!.find(row=>row.stage===ActionWindow.OnPreVote)!.action=whiteAction(10);
  const cast=turns.get(2)!.find(row=>row.stage===ActionWindow.OnPreVote)!;cast.invalidActions=[whiteAction(999)];cast.expectedInvalidError="white_wolf_blast_target";
  for(const row of turns.get(5)!.filter(row=>row.stage==="seer")) row.action={name:"check_identity",args:{target_id:row.day===1?2:1}};
  // Remaining ordinary wolf 1 survives the first interruption and replaces old wolf 2's second-night/final-blast script.
  turns.set(1,[...turns.get(1)!,...foundationTransportPlan(12).get(2)!.filter(row=>row.day===2)]);
  const roles=[Role.Wolf,Role.WhiteWolfKing,Role.Wolf,Role.Wolf,Role.Seer,Role.Witch,Role.Hunter,Role.Idiot,Role.Villager,Role.Villager,Role.Villager,Role.Villager];
  const definition=boardDefinitionFromConfig("twelve_player_white_wolf_king",{...twelvePlayerStandardConfig,roleSetups:[{role:Role.WhiteWolfKing,count:1},{role:Role.Wolf,count:3},...twelvePlayerStandardConfig.roleSetups.slice(1)]});
  return oracle({board:parseBoardDefinition(definition),seed:"foundation-twelve:124680",roles,turns});
 }
 const pending=kind==="pending_poison"||kind==="pending_knife";
 const roles=pending?[Role.WhiteWolfKing,Role.Wolf,Role.Seer,Role.Witch,Role.Villager,Role.Villager]:kind==="wolf_king"?[Role.WhiteWolfKing,Role.WolfKing,Role.Seer,Role.Hunter,Role.Villager,Role.Villager]:[Role.WhiteWolfKing,Role.Wolf,Role.Seer,Role.Hunter,Role.Villager,Role.Villager];
 const counts=roles.map(role=>({role,count:roles.filter(item=>item===role).length})).filter((row,index,all)=>all.findIndex(entry=>entry.role===row.role)===index);
 const actualWindow=pending?ActionWindow.OnPreElection:window;
 const definition=boardDefinitionFromConfig(kind==="wolf_king"?"six_player_white_wolf_king_chain":"six_player_white_wolf_king",{...sixPlayerMvpConfig,roleSetups:counts,winConditions:[WinCondition.SlaughterSide],enableSheriff:true,sheriff:{voteWeight:2.25},hooks:{onPreElection:true,onDaybreak:true,onPreVote:true,onPerSpeechGap:true},selfDestruct:{enabledWindows:[actualWindow]}});
 const turns=new Map<number,PlannedTurn[]>(roles.map((_,index)=>[index+1,[]]));
 const add=(day:number,actors:number[],stage:PlannedTurn["stage"],action:PlannedTurn["action"])=>actors.forEach(actor=>turns.get(actor)!.push({day,stage,action}));
 add(1,[1,2],"wolf_discussion",{name:"speak_to_wolves",args:{text:"End",end_chat:true}});
 add(1,[1,2],"wolf_vote",{name:"kill_vote",args:{target_id:kind==="pending_knife"?1:5,abstain:false}});
 add(1,[3],"seer",{name:"check_identity",args:{target_id:1}});
 if(pending)add(1,[4],"witch",{name:"use_potion",args:{target_id:1,potion_type:kind==="pending_poison"?PotionType.Poison:PotionType.None}});
 if(actualWindow!==ActionWindow.OnPreElection) {
  add(1,[1,2,3,4,5,6],"sheriff_nomination",{name:"run_for_sheriff",args:{run:false}});
  add(1,[5],"last_words",{name:"speak",args:{text:"Night last words"}});
  if(actualWindow===ActionWindow.OnPerSpeechGap)add(1,[1],"day_speech",{name:"speak",args:{text:"First normal speech"}});
  if(actualWindow===ActionWindow.OnPreVote)add(1,[1,2,3,4,6],"day_speech",{name:"speak",args:{text:"Public speech"}});
 }
 const target=kind===PotionType.None?null:pending?3:kind==="wolf_king"?2:4;
 add(1,[1],actualWindow,whiteAction(target));
 turns.get(1)!.at(-1)!.invalidActions=[whiteAction(999)];turns.get(1)!.at(-1)!.expectedInvalidError="white_wolf_blast_target";
 add(1,[2],actualWindow,pending?{name:"self_destruct",args:{reason:"Higher valid candidate",confirm:true}}:null);
 if(actualWindow===ActionWindow.OnPreElection) {
  add(1,pending?(kind==="pending_knife"?[1]:[1,5]):[5],"last_words",{name:"speak",args:{text:"Night last words"}});
 }
 if(kind==="hunter")add(1,[4],"hunter_shot",{name:"shoot",args:{target_id:2}});
 if(kind==="wolf_king") {
  add(1,[2],"death_shot",{name:"shoot",args:{target_id:4}});
  add(1,[4],"hunter_shot",{name:"shoot",args:{target_id:3}});
 }
 if(kind===PotionType.None) {
  add(2,[2],"wolf_discussion",{name:"speak_to_wolves",args:{text:"End",end_chat:true}});
  add(2,[2],"wolf_vote",{name:"kill_vote",args:{target_id:4,abstain:false}});
  add(2,[3],"seer",{name:"check_identity",args:{target_id:2}});
  add(2,[4],"hunter_shot",{name:"shoot",args:{target_id:2}});
 }
 return oracle({board:parseBoardDefinition(definition),roles,turns,seed:pending?"white-wolf-pending_poison:798":kind==="wolf_king"?"white-wolf-wolf_king:336":"white-wolf-hunter:641"}); // Frozen role-specific seed is installed below.
}
