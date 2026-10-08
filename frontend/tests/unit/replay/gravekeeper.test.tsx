import {expect,test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {readReplayDocument,readGravekeeperFeedback} from "@ai-werewolf-arena/replay-contract";
import {eventLabel} from "../../../src/replay/event-labels";
import {buildReplaySnapshot} from "../../../src/replay/replay-projection";
import {createReplayRenderInput,buildReplayFrame} from "../../../src/replay/replay-frame";
import {ReplayFrame} from "../../../src/replay/ReplayComposition";
for(const locale of ["zh-CN","en"] as const)for(const camp of ["good","wolf","third_party"] as const)test(`${locale}/${camp}: passive feedback changes no life, renders only the exact camp and keeps raw data and pure frames`,()=>{
 const raw={schemaVersion:2,sessionId:"grave-display",perspective:"god",meta:{board:"grave_demo",locale,startedAt:"2026-10-08T00:00:00.000Z",endedAt:"2026-10-08T00:01:00.000Z"},result:{winner:null,reason:"in_progress"},players:[{player_id:1,role:"wolf",camp:"wolf"},{player_id:2,role:"gravekeeper",camp:"good"},{player_id:3,role:"villager",camp:"good"}],events:[{seq:1,day:1,phase:"voting",timestamp:"2026-10-08T00:00:00.000Z",type:"voted_out",payload:{target:1}},{seq:2,day:2,phase:"night",stage:"gravekeeper_feedback",timestamp:"2026-10-08T00:01:00.000Z",type:"gravekeeper_reported",payload:{actorId:2,targetId:1,exileDay:1,receivedDay:2,result:{kind:"camp",camp}}}]};
 const before=structuredClone(raw),replay=readReplayDocument(raw),snapshot=buildReplaySnapshot(replay,1);
 expect(snapshot.players.filter(player=>!player.alive).map(player=>player.playerId)).toEqual([1]);
 const label=camp==="good"?locale==="en"?"Good":"好人":camp==="wolf"?locale==="en"?"Werewolves":"狼人":locale==="en"?"Third party":"第三方";
 const expected=locale==="en"?`Gravekeeper 2 learns on night 2 that player 1, exiled on day 1, has camp label ${label}`:`2号守墓人在第2夜获知第1日放逐1号的阵营标签：${label}`;
 expect(eventLabel(replay.events[1],locale)).toBe(expected);const input=createReplayRenderInput(replay,{locale,timeZone:"UTC"});expect(buildReplayFrame(input,100).label).toBe(expected);
 const markup=renderToStaticMarkup(<ReplayFrame input={input} frame={100}/>);expect(markup).toContain(expected);expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={100}/>));expect(raw).toEqual(before);
 const valid=replay.events[1].payload;
 for(const payload of [{...valid,result:{kind:"role",role:"wolf_king"}},{...valid,result:{kind:"camp",camp:"unknown"}},{...valid,targetId:0},{...valid,receivedDay:3},{...valid,extra:"untrusted"}]){expect(readGravekeeperFeedback(payload)).toBeNull();expect(eventLabel({...replay.events[1],payload},locale)).toBe(locale==="en"?"Unknown":"未知");}
});
