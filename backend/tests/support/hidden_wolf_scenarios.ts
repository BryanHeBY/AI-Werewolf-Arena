import {Role,WinCondition,KnightDuelWindow,type BoardConfig} from "../../src/core";
import {parseBoardDefinition,boardDefinitionFromConfig} from "../../src/runtime/config/board_definition";
import {sixPlayerMvpConfig} from "../../src/runtime/scenarios/six_player_mvp";
import type {PlannedTurn} from "./foundation_transport_plan";
import type {TransportGameScenario} from "./run_transport_game";
export const HIDDEN_CASES=["day_good","night_wolf","bear_update","night_inherit","masked_exile","knight","king_link","same_wave","solo_guard","solo_self","twelve","poison_inherit"] as const;
export type HiddenScenario=typeof HIDDEN_CASES[number];
export function hiddenWolfScenario(kind:HiddenScenario):TransportGameScenario{
 const twelve=kind==="twelve",eight=kind==="same_wave"||kind==="poison_inherit",bear=kind==="bear_update",knight=kind==="masked_exile"||kind==="knight",solo=kind.startsWith("solo_");
 const roles=twelve?[Role.HiddenWolf,Role.Wolf,Role.Wolf,Role.Wolf,Role.Bear,Role.Witch,Role.Hunter,Role.Guard,Role.Villager,Role.Villager,Role.Villager,Role.Villager]:eight?[Role.HiddenWolf,Role.Wolf,Role.Witch,Role.Seer,Role.Bear,Role.Villager,Role.Villager,Role.Villager]:bear?[Role.Bear,Role.HiddenWolf,Role.Wolf,Role.Seer,Role.Villager,Role.Villager]:knight?[Role.HiddenWolf,Role.Wolf,Role.Knight,Role.Gravekeeper,Role.Villager,Role.Villager]:solo?[Role.HiddenWolf,Role.Seer,Role.Bear,Role.Guard,Role.Villager,Role.Villager]:[Role.HiddenWolf,kind==="king_link"?Role.WolfKing:Role.Wolf,Role.Seer,Role.Bear,Role.Villager,Role.Villager];
 const config:BoardConfig={...sixPlayerMvpConfig,boardSize:roles.length,roleSetups:[...new Set(roles)].map(role=>({role,count:roles.filter(r=>r===role).length})),winConditions:[WinCondition.SlaughterSide],enableSheriff:twelve,selfDestruct:{enabledWindows:[]},knight:knight?{enabledWindows:[KnightDuelWindow.AfterSpeeches]}:undefined};
 const turns=new Map<number,PlannedTurn[]>(roles.map((_,i)=>[i+1,[]]));
 const add=(day:number,actors:number[],stage:PlannedTurn["stage"],action:PlannedTurn["action"])=>actors.forEach(actor=>turns.get(actor)!.push({day,stage,action}));
 const chat=(day:number,actors:number[])=>add(day,actors,"wolf_discussion",{name:"speak_to_wolves",args:{text:"End",end_chat:true}});
 const knife=(day:number,actors:number[],target:number|null)=>add(day,actors,"wolf_vote",{name:"kill_vote",args:{target_id:target,abstain:target===null}});
 const pack=(day:number,actors:number[],target:number|null)=>{chat(day,actors);knife(day,actors,target);};
 const seer=(day:number,actor:number,target:number)=>add(day,[actor],"seer",{name:"check_identity",args:{target_id:target}});
 const words=(day:number,actors:number[])=>add(day,actors,"last_words",{name:"speak",args:{text:"Authorized words"}});
 const speech=(day:number,actors:number[])=>add(day,actors,"day_speech",{name:"speak",args:{text:"Public speech"}});
 const vote=(day:number,actors:number[],target:number|null)=>add(day,actors,"voting",{name:"vote",args:{target_id:target,abstain:target===null}});
 if(twelve){
  const all=Array.from({length:12},(_,i)=>i+1);
  add(1,[8],"guard",{name:"guard",args:{target_id:10,abstain:false}});pack(1,[2,3,4],9);add(1,[6],"witch",{name:"use_potion",args:{target_id:9,potion_type:"heal"}});
  all.forEach(actor=>add(1,[actor],"sheriff_nomination",{name:"run_for_sheriff",args:{run:actor===1||actor===10}}));add(1,[1,10],"sheriff_campaign_speech",{name:"speak",args:{text:"Campaign"}});add(1,[1],"sheriff_withdraw",{name:"run_for_sheriff",args:{run:true}});add(1,[10],"sheriff_withdraw",{name:"run_for_sheriff",args:{run:false}});add(1,all.filter(id=>id!==1),"sheriff_vote",{name:"vote_for_sheriff",args:{target_id:1,abstain:false}});add(1,[1],"sheriff_choose_direction",{name:"choose_direction",args:{direction:"clockwise"}});speech(1,all);vote(1,all,4);words(1,[4]);
  add(2,[8],"guard",{name:"guard",args:{target_id:11,abstain:false}});pack(2,[2,3],7);add(2,[6],"witch",{name:"use_potion",args:{target_id:3,potion_type:"poison"}});add(2,[7],"hunter_shot",{name:"shoot",args:{target_id:2}});add(2,[1],"sheriff_choose_direction",{name:"choose_direction",args:{direction:"clockwise"}});const alive2=[1,5,6,8,9,10,11,12];speech(2,alive2);vote(2,alive2,9);words(2,[9]);
  add(3,[8],"guard",{name:"guard",args:{target_id:10,abstain:false}});knife(3,[1],6);add(3,[6],"witch",{name:"use_potion",args:{target_id:6,potion_type:"none"}});add(3,[1],"sheriff_choose_direction",{name:"choose_direction",args:{direction:"clockwise"}});const alive3=[1,5,8,10,11,12];speech(3,alive3);vote(3,alive3,1);words(3,[1]);
 }else if(solo){add(1,[4],"guard",{name:"guard",args:{target_id:5,abstain:false}});knife(1,[1],kind==="solo_self"?1:5);seer(1,2,1);if(kind==="solo_self")words(1,[1]);else{speech(1,[1,2,3,4,5,6]);vote(1,[1,2,3,4,5,6],1);words(1,[1]);}
 }else if(eight){pack(1,[2],kind==="same_wave"?1:6);add(1,[3],"witch",{name:"use_potion",args:{target_id:2,potion_type:"poison"}});seer(1,4,1);words(1,kind==="same_wave"?[1,2]:[2,6]);if(kind==="poison_inherit"){speech(1,[1,3,4,5,7,8]);vote(1,[1,3,4,5,7,8],null);knife(2,[1],3);add(2,[3],"witch",{name:"use_potion",args:{target_id:3,potion_type:"none"}});seer(2,4,1);speech(2,[1,4,5,7,8]);vote(2,[1,4,5,7,8],1);words(2,[1]);}
 }else if(knight){pack(1,[2],6);words(1,[6]);speech(1,[1,2,3,4,5]);add(1,[3],"after_speeches",kind==="knight"?{name:"duel",args:{target_id:1,confirm:true}}:null);if(kind==="masked_exile"){vote(1,[1,2,3,4,5],1);words(1,[1]);}pack(2,[2],2);
 }else if(kind==="king_link"){pack(1,[2],2);seer(1,3,1);words(1,[2]);add(1,[2],"death_shot",{name:"shoot",args:{target_id:1}});
 }else if(bear){pack(1,[3],3);seer(1,4,2);words(1,[3]);speech(1,[1,2,4,5,6]);vote(1,[1,2,4,5,6],null);knife(2,[2],4);seer(2,4,2);speech(2,[1,2,5,6]);vote(2,[1,2,5,6],2);words(2,[2]);
 }else{
  pack(1,[2],kind==="night_inherit"?2:5);seer(1,3,1);words(1,kind==="night_inherit"?[2]:[5]);const alive1=kind==="night_inherit"?[1,3,4,5,6]:[1,2,3,4,6];speech(1,alive1);vote(1,alive1,kind==="night_inherit"?null:2);if(kind!=="night_inherit")words(1,[2]);knife(2,[1],kind==="night_wolf"?6:3);seer(2,3,1);if(kind!=="night_wolf"){const alive2=kind==="night_inherit"?[1,4,5,6]:[1,4,6];speech(2,alive2);vote(2,alive2,1);words(2,[1]);}
 }
 const hidden=bear?2:1;
 for(const turn of turns.get(hidden)!){const inherited=solo||kind==="king_link"||(!knight&&kind!=="same_wave"&&(turn.day>1||kind==="night_inherit"||kind==="poison_inherit"||bear));turn.hiddenWolfStatus={inherited,active:inherited&&turn.stage!=="last_words"};if(turn.stage==="last_words"&&(kind==="king_link"||kind==="same_wave"))turn.hiddenWolfStatus={inherited:kind==="king_link",active:false};}
 const family=twelve?"twelve":eight?"witch":bear?"bear":knight?"knight":solo?"solo":kind==="king_link"?"king":"basic",seeds={basic:"hidden-basic:911",bear:"hidden-bear:254",witch:"hidden-witch:3539",king:"hidden-king:616",knight:"hidden-knight:561",solo:"hidden-solo:137",twelve:"hidden-twelve:326384"};
 const wolfIds=roles.flatMap((r,i)=>[Role.Wolf,Role.WolfKing,Role.HiddenWolf].includes(r)?[i+1]:[]);
 return{board:parseBoardDefinition(boardDefinitionFromConfig(`${twelve?"twelve":eight?"eight":"six"}_player_hidden_wolf_${kind}`,config)),seed:seeds[family],roles,turns,promptAssertions:(actor,locale)=>({expectedTeammateIds:actor===hidden?wolfIds.filter(id=>id!==hidden):wolfIds.includes(actor)?wolfIds.filter(id=>id!==actor&&id!==hidden):[],...(actor===hidden?{expectedIdentityMarker:locale==="en"?"your true role is Hidden Wolf.":"真实身份是隐狼。",requiredCurrentMarkers:[locale==="en"?"Your role is Hidden Wolf,":"你的底牌是【隐狼】"]}:{forbiddenCurrentMarkers:[locale==="en"?"Personally inherited the knife:":"本人曾获得刀权："]})})};
}
