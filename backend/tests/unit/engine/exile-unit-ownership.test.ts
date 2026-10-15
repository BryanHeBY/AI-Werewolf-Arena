/**
 * 单元测试验证全板实际投票／PK单位与原Wave提交上下文，及Animal原token和政策计数区别。
 * 输入是固定六席投票、原Animal资源fixture与字面死因；期望阶段名单／计数／身份为手写常量。
 * 只执行有界Voting/DeathResolution或原单位命令，不运行完整经理对局、模型或生成golden。
 */
import { expect, test } from "bun:test";
import { Role, Phase, ActionWindow, DeathCause, type GameEvent } from "@ai-werewolf-arena/game-contract";
import type { ActionRequest, ToolCall } from "../../../src/domain/actions";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { VotingPipeline } from "../../../src/engine/phases/voting-pipeline";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { createDefaultRoleRegistry } from "../../../src/rulesets/mechanism-api";
import { openExileUnit, exileUnitOf } from "../../../src/domain/exile-unit";
import { openNightUnit } from "../../../src/domain/night-unit";
import { DeathResolution } from "../../../src/engine/death-resolution";
import { deathExecutionContext, type DeathCommitReceipt } from "../../../src/engine/death-wave";
import { animalRosterFixture } from "../../support/features/animal-dream/builders/roster";
import { installAnimalAuthority, beginAnimalNight, closeAnimalNight, openAnimalFoxChoice, beginAnimalExileUnit, prepareAnimalCatExpiry, closeAnimalExileUnit, animalAuthoritySnapshot } from "../../../src/features/animal-dream/authority";

function fixture(preVote = false) {
  const config = { ...sixPlayerMvpConfig, hooks: { ...sixPlayerMvpConfig.hooks, onPreVote: preVote }, voting: { exilePolicy: "awa_one_pk_v1" as const }, selfDestruct: { enabledWindows: preVote ? [ActionWindow.OnPreVote] : [] } };
  const { world } = bootstrapGame(config, { fixedRoles: [Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer, Role.Guard] });
  const events: GameEvent[] = [], gateway = new ToolGateway();
  const pipeline = new VotingPipeline({ world, events, toolGateway: gateway, eventRegistry: new EventRegistry(), roleRegistry: createDefaultRoleRegistry() });
  return { config, world, events, gateway, pipeline };
}
function vote(target: number | null): ToolCall { return { name: "vote", args: { target_id: target, abstain: target === null } }; }

test("actual PK and ordinary deaths carry the opened exile identity into the same commit wave", async () => {
  const f = fixture(), asks: ActionRequest[] = [];
  const result = await f.pipeline.execute(f.config, {
    async getAction(request): Promise<ToolCall | null> {
      asks.push(request);
      if (request.context.stage === "voting") return vote([2,1,1,1,2,2][request.actorId-1]!);
      if (request.context.stage === "exile_pk_speech") return { name: "speak", args: { text: "defense" } };
      return vote(1);
    },
  }, { day: 2 });
  const unit = exileUnitOf(result)!;
  expect(unit.day).toBe(2);expect(unit.kind).toBe("exile");
  expect(result.removed).toEqual([1]);
  expect(asks.filter(r => r.context.stage === "exile_pk_vote").map(r => r.actorId)).toEqual([3,4,5,6]);
  let committed: DeathCommitReceipt | undefined;
  const resolver = new DeathResolution(f.world, f.events, f.gateway, new EventRegistry(), { day: 2, phase: Phase.Voting, gameOver: false, result: null });
  await resolver.resolve([1], { 1: [DeathCause.Exile] }, { async getAction() { return { name: "speak", args: { text: "last" } }; } }, Phase.Voting, Phase.Voting, {}, {
    execution: { exile: unit, phaseRevision: 7 },
    onInitialWaveCommitted(ids, _sources, receipt) { committed=receipt;return { timestamp: 1, type: "additional_deaths", payload: { deaths: [...ids] } }; },
  });
  expect(committed!.committed(1)!.units[0]!.execution!.exile).toBe(unit);
  expect(committed!.committed(1)!.units[0]!.execution!.phaseRevision).toBe(7);
  expect(Object.keys(result)).toEqual(["summary", "interrupted", "removed"]);
});

test("all abstentions still create a distinct completed ballot unit at the same day", async () => {
  const f=fixture();
  const a=await f.pipeline.execute(f.config,{async getAction(){return vote(null);}},{day:2});
  const b=await f.pipeline.execute(f.config,{async getAction(){return vote(null);}},{day:2});
  expect(a.removed).toEqual([]);expect(a.summary.target).toBeNull();
  expect(exileUnitOf(a)!.id).not.toBe(exileUnitOf(b)!.id);
});

test("pre-vote self destruction and pre-open current refusal do not manufacture normal exile units",async()=>{
  const f=fixture(true);
  const interrupted=await f.pipeline.execute(f.config,{async getAction(request):Promise<ToolCall|null>{return request.allowedTools.includes("self_destruct")?{name:"self_destruct",args:{confirm:true,reason:"skip"}}:vote(null);}},{day:1});
  expect(interrupted.interrupted).toBe(true);expect(exileUnitOf(interrupted)).toBeUndefined();
  const g=fixture();const stopped=await g.pipeline.execute(g.config,{async getAction(){throw Error("no_request");}},{day:1,isCurrent:()=>false});
  expect(exileUnitOf(stopped)).toBeUndefined();
});

for(const countSkip of [false,true])test(`Animal skip id reuses token while original policy controls count: ${countSkip}`,()=>{
  const f=animalRosterFixture(undefined,(world,config)=>installAnimalAuthority(world,{...config,whiteCat:{skippedVotePolicy:countSkip?"awa_expire_on_skipped_day_v1":"awa_wait_for_actual_exile_v1"}}));
  beginAnimalNight(f.world,1,()=>true);closeAnimalNight(f.world,1,"normal");
  const token=beginAnimalExileUnit(f.world,1,"skipped_day",()=>true), first=openExileUnit(1,"skipped_day",token);
  expect(first.id).toBe(token);prepareAnimalCatExpiry(f.world,token);closeAnimalExileUnit(f.world,token);
  expect(animalAuthoritySnapshot(f.world)!.completedUnits).toBe(countSkip?1:0);
  beginAnimalNight(f.world,2,()=>true);openAnimalFoxChoice(f.world,2).commit(null);closeAnimalNight(f.world,2,"normal");
  const token2=beginAnimalExileUnit(f.world,2,"skipped_day",()=>true), second=openExileUnit(2,"skipped_day",token2);
  expect(second.id).not.toBe(first.id);expect(animalAuthoritySnapshot(f.world)!.unit!.number).toBe(countSkip?2:1);
});

test("mixed night and day deaths keep per-entry source phases and clocks as execution context",async()=>{
  const f=fixture(), night=openNightUnit(1), exile=openExileUnit(1,"skipped_day");let receipt:DeathCommitReceipt|undefined;
  await new DeathResolution(f.world,f.events,f.gateway,new EventRegistry(),{day:1,phase:Phase.Day,gameOver:false,result:null}).resolve([3,4],{3:[DeathCause.WolfKill],4:[DeathCause.SelfDestruct]},{async getAction(){return {name:"speak",args:{text:"last"}};}},Phase.Night,Phase.Day,{4:Phase.Day},{nightOriginIds:[3],execution:{night,exile,phaseRevision:2},onInitialWaveCommitted(ids,_sources,r){receipt=r;return {timestamp:1,type:"additional_deaths",payload:{deaths:[...ids]}};}});
  expect(receipt!.committed(3)!.originPhase).toBe(Phase.Night);expect(receipt!.committed(4)!.originPhase).toBe(Phase.Day);
  expect(receipt!.committed(3)!.units[0]!.execution!.night).toBe(night);expect(receipt!.committed(4)!.units[0]!.execution!.exile).toBe(exile);
});

test("old clock metadata getter and Proxy do not execute new reads",()=>{
  let reads=0;const old={get execution(){reads++;throw Error("unused");}};
  expect(deathExecutionContext(old)).toBeUndefined();
  expect(deathExecutionContext(new Proxy({}, {get(){reads++;throw Error("unused");},getOwnPropertyDescriptor(){reads++;throw Error("unused");}}))).toBeUndefined();
  expect(reads).toBe(0);
});


test("execution-only empty duel metadata does not consult inherited night callbacks",async()=>{
  const f=fixture(), resolver=new DeathResolution(f.world,f.events,f.gateway,new EventRegistry(),{day:1,phase:Phase.Day,gameOver:false,result:null});
  const metadata=Object.create(null) as {execution:{phaseRevision:number}};
  metadata.execution={phaseRevision:3};let reads=0;
  const keys=["isCurrent","onInitialWaveCommitted","dreams","animalUnit"] as const;
  const before=keys.map(key=>Object.getOwnPropertyDescriptor(Object.prototype,key));
  try {
    for(const key of keys)Object.defineProperty(Object.prototype,key,{configurable:true,get(){reads++;throw Error("inherited_night_option_unused");}});
    await resolver.resolve([],{}, {async getAction(){throw Error("no_request");}},Phase.Day,Phase.Day,{},metadata);
    expect(reads).toBe(0);
  } finally {
    keys.forEach((key,index)=>{if(before[index])Object.defineProperty(Object.prototype,key,before[index]!);else delete (Object.prototype as Record<string,unknown>)[key];});
  }
});
