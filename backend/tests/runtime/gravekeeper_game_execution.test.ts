import { fixtureNumber } from "../support/fixture_values";
import { Camp, DeathCause, Phase } from "../../src/core";
import {expect,test} from "bun:test";
import {writeFile} from "node:fs/promises";
import {GRAVEKEEPER_CASES,gravekeeperScenario,graveFeedback,type GravekeeperScenario} from "../support/gravekeeper_scenarios";
import {runTransportGame} from "../support/run_transport_game";
const expected:{[K in GravekeeperScenario]:{reports:ReturnType<typeof graveFeedback>[];alive:number[];words:number[];day:number;winners:number[]}}={
 six:{reports:[graveFeedback(1,2,1,"wolf"),graveFeedback(2,3,4,"good")],alive:[3,5],words:[6,1,4,2],day:3,winners:[3,4,5,6]},
 idiot:{reports:[graveFeedback(2,3,1,"wolf")],alive:[3,4,5],words:[6,1,2],day:3,winners:[3,4,5,6]},
 blast:{reports:[graveFeedback(2,3,4,"good")],alive:[3,5],words:[6,4,2],day:3,winners:[3,4,5,6]},
 stale_blast:{reports:[graveFeedback(1,2,1,"wolf")],alive:[3,4,5],words:[1,6],day:3,winners:[3,4,5]},
 hunter_chain:{reports:[graveFeedback(1,2,1,"wolf")],alive:[3],words:[6,1,2],day:2,winners:[3,4,5,6]},
 keeper_exiled:{reports:[],alive:[4,5],words:[6,3,1,2],day:3,winners:[3,4,5,6]},
 keeper_night_killed:{reports:[graveFeedback(1,2,1,"wolf")],alive:[4,5],words:[6,1,2],day:2,winners:[3,4,5,6]},
 twelve:{reports:[graveFeedback(1,2,1,"wolf"),graveFeedback(2,3,5,"good")],alive:[6,8,10,11,12],words:[1,5,2],day:3,winners:[5,6,7,8,9,10,11,12]},
};
for(const kind of GRAVEKEEPER_CASES)for(const transport of ["llm","acp","mixed"] as const)test(`${kind}/${transport}: actual bilingual passive feedback complete games preserve literal outcomes, private prompts and strict replay`,async()=>{
 const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
 for(const locale of ["zh-CN","en"] as const){
  const run=await runTransportGame(gravekeeperScenario(kind),transport,locale);runs.push(run);const events=run.replay.events,keeper=kind==="twelve"?8:3,oracle=expected[kind];
  const reports=oracle.reports.map(({camp,...report})=>({...report,result:{kind:"camp",camp}}));
  expect(events.filter(event=>event.type==="gravekeeper_reported").map(event=>event.payload)).toEqual(reports.map(report=>({...report,actorId:keeper})));
  expect(run.record.checkpoints.at(-1)!.players.find(player=>player.id===keeper)!.privateState.gravekeeper).toEqual({history:reports});
  expect(run.result.snapshot.result).toEqual({winner:Camp.Good,reason:"all_wolves_eliminated",outcome:{kind:"victory",primary:{kind:"faction",faction:Camp.Good,winningPlayerIds:oracle.winners},additional:[],winningPlayerIds:oracle.winners},decidedAt:{day:oracle.day,phase:Phase.Voting,checkpoint:"exile_settled"}});
  expect(run.manifest.players.filter(player=>player.alive).map(player=>player.player_id)).toEqual(oracle.alive);
  expect(events.filter(event=>event.type==="last_words_spoken").map(event=>event.payload.playerId)).toEqual(oracle.words);
  expect(events.filter(event=>event.type==="game_over")).toHaveLength(1);expect(events.at(-1)!.type).toBe("game_over");
  for(const view of run.views){const delivered=view.timeline.filter(entry=>entry.kind==="event"&&entry.event.type==="gravekeeper_reported");expect(delivered).toHaveLength(view.player_id===keeper?reports.length:0);}
  const feedback=events.filter(event=>event.type==="gravekeeper_reported");for(const event of feedback){expect(event.phase).toBe("night");expect(event.day).toBe(fixtureNumber(event.payload.receivedDay));expect(event.payload).not.toHaveProperty("role");}
  if(kind==="keeper_night_killed")expect(run.views.find(view=>view.player_id===3)!.timeline.filter(entry=>entry.kind==="turn").every(entry=>entry.day===1)).toBe(true);
  if(kind==="hunter_chain")expect(events.filter(event=>event.type==="wolf_king_shot"||event.type==="hunter_shot").map(event=>event.payload)).toEqual([{actorId:1,targetId:4},{hunterId:4,targetId:5}]);
  if(kind==="idiot")expect(events.filter(event=>event.type==="idiot_revealed").map(event=>event.payload.targetId)).toEqual([4]);
  if(kind==="stale_blast")expect(feedback).toHaveLength(1);
  if(kind==="twelve"&&transport==="llm")await writeFile(`/tmp/awa-p5-grave-${locale}.replay.json`,JSON.stringify(run.replay));
 }
 const neutral=(events:typeof runs[0]["replay"]["events"])=>events.map(({timestamp:_time,...event})=>event);
 expect(runs[0].result).toEqual(runs[1].result);expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
},120000);
