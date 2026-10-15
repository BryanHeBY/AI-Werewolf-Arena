import {World} from '/home/hby/dev/AI-Werewolf-Arena/backend/src/core/domain/world';
import {assertScholarMentorBonusEffects} from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/scholar_mentor/night_stages';
import type {NightStageContext} from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/stages/night/contracts';
const trace:string[]=[];
const state={get modifierBonusEffects(){trace.push('slot');return[{kind:'check',receipt:{get target(){trace.push('target');return null;},effectCurrent(){trace.push('current');return false;}}}];}};
const context={world:new World(),get state(){trace.push('state');return state;}} as unknown as NightStageContext;
let result='accepted';try{assertScholarMentorBonusEffects(context);}catch(e){result=(e as Error).message;}
if(result!=='scholar_mentor_bonus_effect_stale'||JSON.stringify(trace)!==JSON.stringify(['state','slot','target','current']))throw Error('old_characterization_not_expected');
console.log(JSON.stringify({base:'2a2e447aaab16219508dea759e4a8eaf7971187b',case:'custom slot getter injects receipt into actual old assert',result,trace}));
