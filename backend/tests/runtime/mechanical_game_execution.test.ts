import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { MECHANICAL_CASES, mechanicalScenario, type MechanicalScenario } from "../support/mechanical_scenarios";
import { runTransportGame } from "../support/run_transport_game";

const facts: Record<MechanicalScenario, { alive:number[]; words:number[]; day:number; learned:string; ready:number }> = {
  villager:{alive:[3,4,6],words:[2,1],day:2,learned:"villager",ready:2},
  inspection:{alive:[3,4,5],words:[2,6,1],day:3,learned:"psychic",ready:2},
  poison:{alive:[4,5,6],words:[2,1],day:2,learned:"witch",ready:2},
  reflection:{alive:[3,5,6],words:[2,1],day:2,learned:"guard",ready:2},
  guard_failure:{alive:[3,4,5],words:[2,6],day:3,learned:"guard",ready:2},
  hunter:{alive:[3,5],words:[2,1],day:2,learned:"hunter",ready:2},
  extra:{alive:[4,5],words:[2,1],day:2,learned:"wolf",ready:2},
  late:{alive:[4,5],words:[2,3,1],day:3,learned:"witch",ready:3},
  twelve:{alive:[5,10,11,12],words:[4,9,1],day:3,learned:"hunter",ready:2},
};

for (const kind of MECHANICAL_CASES) for (const transport of ["llm","acp","mixed"] as const) test(`${kind}/${transport}: real bilingual mechanical games preserve independent skills, authority, privacy and strict Tape`, async () => {
  const runs=[];
  for (const locale of ["zh-CN","en"] as const) {
    const scenario=mechanicalScenario(kind), run=await runTransportGame(scenario,transport,locale);runs.push(run);
    const oracle=facts[kind], events=run.replay.events;
    expect(run.manifest.players.filter(p=>p.alive).map(p=>p.player_id)).toEqual(oracle.alive);
    expect(events.filter(e=>e.type==="last_words_spoken").map(e=>e.payload.playerId)).toEqual(oracle.words);
    expect(events.filter(e=>e.type==="mechanical_mimicked").map(e=>[e.payload.role,e.payload.readyOnNight])).toEqual([[oracle.learned,oracle.ready]]);
    expect(events.filter(e=>e.type==="mechanical_awakened").map(e=>e.payload)).toEqual([{actorId:1,day:kind==="twelve"?2:1,firstKnifeNight:kind==="twelve"?3:2}]);
    const state=run.record.checkpoints.at(-1)!.players.find(p=>p.id===1)!.privateState.mechanical_wolf as any;
    expect(state.learned.role).toBe(oracle.learned);expect(state.learned.readyOnNight).toBe(oracle.ready);
    if(kind==="inspection")expect(state.learned.skill.history).toEqual([{day:2,targetId:4,result:{kind:"role",role:"witch"}},{day:3,targetId:4,result:{kind:"role",role:"witch"}}]);
    if(kind==="poison")expect(state.learned.skill).toEqual({kind:"poison",remaining:0});
    if(kind==="late"){expect(state.learned.skill).toEqual({kind:"poison",remaining:1});expect(events.filter(e=>e.type==="mechanical_mimic_skipped").map(e=>e.payload.day)).toEqual([1]);expect(events.filter(e=>e.type==="mechanical_mode_selected").at(-1)!.payload.mode).toBe("skill");expect(events.filter(e=>e.type==="mechanical_skill_skipped").map(e=>e.payload.day)).toEqual([3]);}
    if(kind==="reflection")expect(events.filter(e=>e.type==="mechanical_poison_reflected").map(e=>e.payload)).toEqual([{actorId:1,day:2,protectedTargetId:3,casterId:4}]);
    if(kind==="guard_failure")expect(events.filter(e=>e.type==="mechanical_guard_chosen").map(e=>e.payload.failed)).toEqual([false,true]);
    if(kind==="extra"){expect(state.learned.skill).toEqual({kind:"wolf",extraKnife:"spent"});expect(events.filter(e=>e.type==="mechanical_attack_chosen").map(e=>e.payload)).toEqual([{actorId:1,day:2,targetId:3}]);}
    if(kind==="hunter"||kind==="twelve"){expect(state.learned.skill).toEqual({kind:"hunter",canShoot:false,armed:true});expect(events.filter(e=>e.type==="mechanical_shot").map(e=>e.payload)).toEqual([{actorId:1,targetId:kind==="twelve"?8:4}]);}
    const winners=kind==="twelve"?[5,6,7,8,9,10,11,12]:[3,4,5,6],night=kind==="guard_failure";
    expect(run.result.snapshot.result).toEqual({winner:"good",reason:"all_wolves_eliminated",outcome:{kind:"victory",primary:{kind:"faction",faction:"good",winningPlayerIds:winners},additional:[],winningPlayerIds:winners},decidedAt:{day:oracle.day,phase:night?"day":"voting",checkpoint:night?"night_settled":"exile_settled"}});
    for(const view of run.views){
      const projected=view.timeline.filter(row=>row.kind==="event").map(row=>row.event);
      expect(projected.some(e=>e.type==="mechanical_poison_reflected")).toBe(false);
      expect(projected.filter(e=>e.type==="mechanical_mimicked")).toHaveLength(view.player_id===1?1:0);
      if(view.player_id===1)expect(projected.some(e=>["wolf_discussion","wolf_tactical_order"].includes(e.type))).toBe(false);
    }
    expect(run.rejected.size).toBe(0);expect(run.acpTraces.every(row=>row.trace.rejected===0)).toBe(true);
    expect(events.filter(e=>e.type==="game_over")).toHaveLength(1);expect(events.at(-1)!.type).toBe("game_over");
    if(["reflection","twelve","guard_failure"].includes(kind)&&transport==="llm")await writeFile(`/tmp/awa-p7-mechanical-${kind}-${locale}.replay.json`,JSON.stringify(run.replay));
  }
  const neutral=(events:typeof runs[0]["replay"]["events"])=>events.map(({timestamp:_time,...event})=>event);
  expect(runs[0].result).toEqual(runs[1].result);expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
},120000);
