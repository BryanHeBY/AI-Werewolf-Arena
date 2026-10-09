import { KnightDuelWindow, PotionType, Role, WinCondition, type BoardConfig } from "../../src/core";
import {parseBoardDefinition,boardDefinitionFromConfig} from "../../src/runtime/config/board_definition";
import {sixPlayerMvpConfig} from "../../src/runtime/scenarios/six_player_mvp";
import type {PlannedTurn} from "./foundation_transport_plan";
import type {TransportGameScenario} from "./run_transport_game";
export const BEAUTY_CASES=["exile",PotionType.Poison,"duel","night_dream_block","night_dream_chain","same_wave","last_god","last_villager","city_first","side_first","skip","twelve"] as const;
export type BeautyScenario=typeof BEAUTY_CASES[number];
export function wolfBeautyScenario(kind:BeautyScenario):TransportGameScenario{
 const twelve=kind==="twelve",special=["last_god","city_first","side_first"].includes(kind),dream=kind.startsWith("night_dream");
 const roles=twelve?[Role.WolfBeauty,Role.Wolf,Role.Wolf,Role.Wolf,Role.Seer,Role.Witch,Role.Guard,Role.Knight,Role.Villager,Role.Villager,Role.Villager,Role.Villager]:special?[Role.WolfBeauty,Role.Witch,Role.Knight,Role.Villager,Role.Villager,Role.Villager]:kind==="last_villager"?[Role.WolfBeauty,Role.Witch,Role.Knight,Role.Knight,Role.Seer,Role.Villager]:[Role.WolfBeauty,Role.Wolf,Role.Witch,dream?Role.Dreamer:Role.Knight,kind==="same_wave"?Role.Hunter:Role.Villager,Role.Villager];
 const config:BoardConfig={...sixPlayerMvpConfig,boardSize:roles.length,roleSetups:[...new Set(roles)].map(role=>({role,count:roles.filter(r=>r===role).length})),enableSheriff:twelve,winConditions:kind==="city_first"?[WinCondition.SlaughterCity,WinCondition.SlaughterSide]:kind==="side_first"?[WinCondition.SlaughterSide,WinCondition.SlaughterCity]:[WinCondition.SlaughterSide],selfDestruct:{enabledWindows:[]},knight:{enabledWindows:[KnightDuelWindow.AfterSpeeches]}};
 const turns=new Map<number,PlannedTurn[]>(roles.map((_,index)=>[index+1,[]]));
 const add=(day:number,actors:number[],stage:PlannedTurn["stage"],action:PlannedTurn["action"])=>actors.forEach(actor=>turns.get(actor)!.push({day,stage,action}));
 const night=(day:number,actors:number[],target:number|null)=>{add(day,actors,"wolf_discussion",{name:"speak_to_wolves",args:{text:"End",end_chat:true}});add(day,actors,"wolf_vote",{name:"kill_vote",args:{target_id:target,abstain:target===null}});};
 const charm=(day:number,target:number|null)=>add(day,[1],"wolf_beauty",{name:"charm",args:{target_id:target}});
 const potion=(day:number,actor:number,target:number,type: PotionType = PotionType.None)=>add(day,[actor],"witch",{name:"use_potion",args:{target_id:target,potion_type:type}});
 const speech=(day:number,actors:number[])=>add(day,actors,"day_speech",{name:"speak",args:{text:"Public speech"}});
 const vote=(day:number,actors:number[],target:number|null)=>add(day,actors,"voting",{name:"vote",args:{target_id:target,abstain:target===null}});
 const words=(day:number,actors:number[])=>add(day,actors,"last_words",{name:"speak",args:{text:"Authorized words"}});
 const knight=(day:number,actors:number[],target?:number)=>add(day,actors,KnightDuelWindow.AfterSpeeches,target===undefined?null:{name:"duel",args:{target_id:target,confirm:true}});
 if(twelve){
  const all=Array.from({length:12},(_,i)=>i+1);
  for(const day of [1,2,3]){
   if(day!==3)add(day,[7],"guard",{name:"guard",args:{target_id:day===2?12:10,abstain:false}});
   night(day,day===1?[1,2,3,4]:day===2?[1,3,4]:[1],day===2?7:9);charm(day,day===1?null:day===2?11:12);
   potion(day,6,day===1?9:day===2?3:6,day===1?PotionType.Heal:day===2?PotionType.Poison:PotionType.None);
   add(day,[5],"seer",{name:"check_identity",args:{target_id:day===1?2:day===2?4:1}});
   if(day===1)add(day,all,"sheriff_nomination",{name:"run_for_sheriff",args:{run:false}});
   const alive=day===1?all:day===2?[1,4,5,6,8,9,10,11,12]:[1,5,6,8,10,11,12];speech(day,alive);knight(day,[8]);vote(day,alive,day===1?2:day===2?4:1);words(day,[day===1?2:day===2?4:1]);
  }
 }else if(special||kind==="last_villager"){
  night(1,[1],3);charm(1,special?2:6);potion(1,2,2);if(!special)add(1,[5],"seer",{name:"check_identity",args:{target_id:1}});words(1,[3]);speech(1,[1,2,4,5,6]);if(!special)knight(1,[4]);vote(1,[1,2,4,5,6],1);words(1,[1]);
 }else if(kind==="skip"){
  for(const day of [1,2,3]){
   night(day,day===3?[1]:[1,2],day===3?6:null);charm(day,day===2?null:5);
   if(day===2){const turn=turns.get(1)!.at(-1)!;turn.invalidActions=[{name:"charm",args:{target_id:5}}];turn.expectedInvalidError="charm_repeat";}
   potion(day,3,3);const alive=day===1||day===2?[1,2,3,4,5,6]:[1,3,4,5];speech(day,alive);knight(day,[4]);vote(day,alive,day===1?null:day===2?2:1);if(day!==1)words(day,[day===2?2:1]);
  }
 }else{
  if(dream)add(1,[4],"dreamer",{name:"dream",args:{target_id:5}});
  night(1,[1,2],kind==="same_wave"?5:6);charm(1,kind==="duel"?3:kind==="night_dream_chain"?4:5);potion(1,3,kind===PotionType.Poison||dream||kind==="same_wave"?1:3,kind===PotionType.Poison||dream||kind==="same_wave"?PotionType.Poison:PotionType.None);
  words(1,kind===PotionType.Poison||dream?[1,6]:kind==="same_wave"?[1,5]:[6]);
  if(kind!==PotionType.Poison&&kind!=="night_dream_chain"){
   const alive=kind==="night_dream_block"?[2,3,4,5]:kind==="same_wave"?[2,3,4,6]:[1,2,3,4,5];speech(1,alive);if(!dream)knight(1,[4],kind==="duel"?1:undefined);
   if(kind==="duel"){night(2,[2],2);potion(2,3,3);}else{vote(1,alive,kind==="night_dream_block"||kind==="same_wave"?2:1);words(1,[kind==="night_dream_block"||kind==="same_wave"?2:1]);}
  }
 }
 // Static role/state assertions; transport scripts receive no World or RNG capability.
 let latest:NonNullable<PlannedTurn["charmLatest"]>={day:null,targetId:null};
 for(const turn of turns.get(1)!){turn.charmLatest=latest;if(turn.action?.name==="charm")latest={day:turn.day,targetId:turn.action.args.target_id};}
 const family=twelve?"twelve":special?"god":kind==="last_villager"?"villager":kind==="same_wave"?"hunter":dream?"dream":"exile",seeds={twelve:"beauty-twelve:4020350",god:"beauty-god:141",villager:"beauty-villager:57",hunter:"beauty-hunter:662",dream:"beauty-dream:618",exile:"beauty-exile:414"};
 return{board:parseBoardDefinition(boardDefinitionFromConfig(`${twelve?"twelve":"six"}_player_wolf_beauty_${kind}`,config)),roles,turns,seed:seeds[family],promptAssertions:(actor,locale)=>actor===1?{expectedIdentityMarker:locale==="en"?"your true role is Wolf Beauty.":"真实身份是狼美人。",requiredCurrentMarkers:[locale==="en"?"Your role is Wolf Beauty,":"你的底牌是【狼美人】",locale==="en"?"configured victory conditions still use their first matching order":"配置的胜利条件仍按先命中顺序判断"]}:{forbiddenCurrentMarkers:[locale==="en"?"Current charm target:":"当前魅惑目标："]}};
}
