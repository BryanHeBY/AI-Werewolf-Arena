import {expect,test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {readReplayDocument} from "@ai-werewolf-arena/replay-contract";
import {eventLabel} from "../../../src/replay/event-labels";
import {buildReplaySnapshot} from "../../../src/replay/replay-projection";
import {createReplayRenderInput,buildReplayFrame,FRAMES_PER_EVENT} from "../../../src/replay/replay-frame";
import {ReplayFrame} from "../../../src/replay/ReplayComposition";
import skip from "../../fixtures/psychic-skip.replay.json";
import twelve from "../../fixtures/psychic-twelve.replay.json";
for(const locale of ["zh-CN","en"] as const)for(const large of [false,true])test(`${locale}/${large}: actual Spirit Seer pass/repeat events change no seat and remain pure in timeline/video`,()=>{
  const raw=structuredClone(large?twelve:skip);raw.meta.locale=locale;const before=structuredClone(raw),replay=readReplayDocument(raw),event=large?replay.events.filter(e=>e.type==="role_inspected").at(-1)!:replay.events.find(e=>e.type==="role_inspection_skipped")!,index=replay.events.indexOf(event),previous=buildReplaySnapshot(replay,index-1),snapshot=buildReplaySnapshot(replay,index);
  expect(snapshot.players).toEqual(previous.players);expect(snapshot.decision).toBeNull();expect(snapshot.players.find(p=>p.playerId===(large?5:3))!.alive).toBe(true);
  if(large)expect(event.payload).toEqual({actorId:5,targetId:1,day:3,result:{kind:"role",role:"wolf"}});else expect(event.payload).toEqual({actorId:3,day:2,reason:"passed"});
  const label=large?(locale==="en"?"Player 5 inspects player 1's role: Werewolf":"5号查验1号的具体角色：狼人"):(locale==="en"?"Player 3 ends the inspection opportunity on night 2: Passed":"3号在第2夜结束查验机会：主动跳过");expect(eventLabel(event,locale)).toBe(label);const input=createReplayRenderInput(replay,{locale,timeZone:"UTC"}),frame=input.replay.events.findIndex(e=>e.seq===event.seq)*FRAMES_PER_EVENT+10;expect(buildReplayFrame(input,frame).label).toBe(label);const markup=renderToStaticMarkup(<ReplayFrame input={input} frame={frame}/>);expect(markup).toContain(label.replaceAll("'","&#x27;"));expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame}/>));
  const final=buildReplaySnapshot(replay,replay.events.length-1);expect(final.players.filter(p=>p.isWinner).map(p=>p.playerId)).toEqual(large?[5,6,7,8,9,10,11,12]:[1,2]);expect(raw).toEqual(before);
});
for(const locale of ["zh-CN","en"] as const)test(`${locale}: pass reason is strict and unknown extensions never become a fabricated inspection`,()=>{
 const replay=readReplayDocument(skip),event=replay.events.find(e=>e.type==="role_inspection_skipped")!;expect(eventLabel({...event,payload:{...event.payload,reason:"unknown"}},locale)).toBe(locale==="en"?"Unknown":"未知");expect(eventLabel({...event,payload:{...event.payload,reason:"no_targets"}},locale)).toBe(locale==="en"?"Player 3 ends the inspection opportunity on night 2: No other living targets":"3号在第2夜结束查验机会：没有其它存活目标");
});
