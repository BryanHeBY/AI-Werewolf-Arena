import {expect,test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {readReplayDocument} from "@ai-werewolf-arena/replay-contract";
import {eventLabel} from "../../../src/replay/event-labels";
import {buildReplaySnapshot} from "../../../src/replay/replay-projection";
import {createReplayRenderInput,buildReplayFrame} from "../../../src/replay/replay-frame";
import {ReplayFrame} from "../../../src/replay/ReplayComposition";
for(const locale of ["zh-CN","en"] as const)for(const targetId of [2,null])test(`${locale}/${targetId}: White Wolf King records both deaths atomically and distinguishes taking nobody`,()=>{
 const raw={schemaVersion:2,sessionId:"white-display",perspective:"god",meta:{board:"white_demo",locale,startedAt:"2026-10-08T00:00:00.000Z",endedAt:"2026-10-08T00:01:00.000Z"},result:{winner:null,reason:"in_progress"},players:[{player_id:1,role:"white_wolf_king",camp:"wolf"},{player_id:2,role:"hunter",camp:"good"},{player_id:3,role:"villager",camp:"good"}],events:[{seq:1,day:1,phase:"day",timestamp:"2026-10-08T00:01:00.000Z",type:"white_wolf_king_self_destruct",payload:{actorId:1,targetId,window:"on_daybreak"}}]};
 const before=structuredClone(raw),replay=readReplayDocument(raw),snapshot=buildReplaySnapshot(replay,0);
 expect(snapshot.players.filter(player=>!player.alive).map(player=>player.playerId)).toEqual(targetId===null?[1]:[1,2]);
 const expected=targetId===null?locale==="en"?"White Wolf King 1 self-destructs and deliberately takes nobody":"1号白狼王自爆，明确不带人":locale==="en"?"White Wolf King 1 self-destructs and takes player 2":"1号白狼王自爆并带走2号";
 expect(eventLabel(replay.events[0],locale)).toBe(expected);
 const input=createReplayRenderInput(replay,{locale,timeZone:"UTC"});expect(buildReplayFrame(input,10).label).toBe(expected);
 const markup=renderToStaticMarkup(<ReplayFrame input={input} frame={10}/>);expect(markup).toContain(expected);expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={10}/>));expect(raw).toEqual(before);
});
