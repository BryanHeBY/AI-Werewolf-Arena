/**
 * 单元测试负责验证秘密之身同步翻牌、已耗身失败前缀和原 Provider 等待后的关闭／复验。
 * 输入为真实板子原对象、明确请求与故障回调；字面读序、付款、公开事实和错误身份为独立预期。
 * 只执行本族交接及一次真实投票流水线，不运行整局、模型或新增资源规则。
 */
import { expect, test } from "bun:test";
import type { ActionRequest, ToolCall, GameEvent } from "@ai-werewolf-arena/game-contract";
import { createDefaultRoleRegistry } from "../../../../src/rulesets/roles/permissions";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { nobleSecretBodyTwelveConfig } from "../../../../src/rulesets/presets/noble-secret-body-twelve";
import { COMPONENT } from "../../../../src/domain/components/names";
import type { ActionProvider } from "../../../../src/domain/actions";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { VotingPipeline } from "../../../../src/engine/phases/voting-pipeline";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { revealSecretBodyExile, type SecretBodyExileRevealQueries } from "../../../../src/features/noble-secret-body/exile-reveal";
import { beginNobleBodyNight, openSecretBodyChoice, expireServantAtNightEnd, closeNobleBodyNight, resolveSecretBodyDamage, checkpointNobleBodyAuthority } from "../../../../src/features/noble-secret-body/authority";
import { nobleBodyRequestScope } from "../../../../src/features/noble-secret-body/requests";
import { deferRequestDelivery } from "../../../../src/domain/request-delivery";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import type { SessionRecordManager } from "../../../../src/recording/session/recorder";

function fixture() {
  const config = nobleSecretBodyTwelveConfig();
  const game = bootstrapGame(config, { fixedRoles: config.roleSetups.flatMap(r => Array(r.count).fill(r.role)) });
  beginNobleBodyNight(game.world, 1, () => true);
  openSecretBodyChoice(game.world, 1).commit(null);
  expireServantAtNightEnd(game.world, 1);
  closeNobleBodyNight(game.world, 1, "normal");
  resolveSecretBodyDamage(game.world, 1, {});
  const events: GameEvent[] = [];
  const gateway = new ToolGateway();
  const requests = new GameActionRequestFactory(game.world, events, 1);
  return { ...game, config, events, gateway, requests };
}

function queries(f: ReturnType<typeof fixture>): SecretBodyExileRevealQueries {
  return { enabled:f.config.nobleSecretBody, world:f.world, events:f.events, toolGateway:f.gateway, requests:f.requests, day:1, isCurrent:undefined };
}

function voting(f: ReturnType<typeof fixture>, provider: ActionProvider, isCurrent = () => true) {
  const pipeline = new VotingPipeline({world:f.world, roleRegistry:createDefaultRoleRegistry(), toolGateway:f.gateway, eventRegistry:new EventRegistry(), events:f.events});
  return pipeline.execute({...f.config, hooks:{...f.config.hooks, onPreVote:false}}, provider, {day:1,isCurrent});
}

const vote: ToolCall = {name:"vote",args:{target_id:5,abstain:false}};

test("未启用不读 World，目标不匹配或库存已耗尽均同步结束而不交请求", () => {
  const trace:string[]=[];
  const disabled = revealSecretBodyExile({
    get enabled() {trace.push("enabled");return undefined;},
    get world(): never {throw new Error("world_must_not_read");},
  } as unknown as SecretBodyExileRevealQueries, 5);
  queueMicrotask(()=>trace.push("queued"));
  expect(disabled.next()).toEqual({done:true,value:false});
  expect(trace).toEqual(["enabled"]);
  const f=fixture();
  expect(revealSecretBodyExile(queries(f), 6).next()).toEqual({done:true,value:false});
  expect(checkpointNobleBodyAuthority(f.world,true).body.body).toEqual({kind:"intact"});
  const triggered = revealSecretBodyExile(queries(f), 5);
  expect(triggered.next().done).toBe(false);
  triggered.return(false);
  expect(revealSecretBodyExile(queries(f), 5).next()).toEqual({done:true,value:false});
});

test("必需录制失败保耗身与公开事实，尚未读取请求工厂或打开 speech scope", () => {
  const f=fixture(),failure=new Error("literal_required_reveal_record_failed"),trace:string[]=[];
  const q:SecretBodyExileRevealQueries={
    get enabled(){trace.push("enabled");return f.config.nobleSecretBody;},
    get world(){trace.push("world");return f.world;},
    get day(){trace.push("day");return 1;},
    get events(){trace.push("events");return f.events;},
    get requests():never {trace.push("requests");throw new Error("request_must_not_read");},
    get toolGateway():never {throw new Error("gateway_must_not_read");},
    get isCurrent():never {throw new Error("current_must_not_read");},
  };
  const recorder={recordRequiredLogicOp(){trace.push("required-record");throw failure;}} as unknown as SessionRecordManager;
  let caught:unknown;
  try {runWithSessionRecorder(recorder,()=>revealSecretBodyExile(q,5).next());}catch(error){caught=error;}
  expect(caught).toBe(failure);
  expect(trace).toEqual(["enabled","world","world","day","events","required-record"]);
  expect(f.events.map(e=>e.type)).toEqual(["secret_body_revealed"]);
  expect(f.events[0]!.payload).toEqual({policy:"awa_noble_secret_body_v1",actorId:5,day:1});
  expect(checkpointNobleBodyAuthority(f.world,true).body.body).toEqual({kind:"exile_revealed",day:1});
  expect(checkpointNobleBodyAuthority(f.world,true).nights[0]).toMatchObject({revealOpened:false,revealCompleted:false});
});

for(const mode of ["sync","reject","close-error"] as const)
  test(`Provider ${mode}保已付款前缀并恰好关闭一次，关闭失败按原finally优先`, async () => {
    const f=fixture(),providerFailure=new Error("literal_reveal_provider_failed"),closeFailure=new Error("literal_reveal_close_failed");
    let original:ActionRequest|undefined,scope:object|undefined,settles=0;
    const provider:ActionProvider={getAction(request){
      if(request.context.stage!=="awakened_idiot_reveal_speech")return Promise.resolve(vote);
      original=request;scope=nobleBodyRequestScope(f.world,request);
      expect(scope).toBeDefined();
      expect(deferRequestDelivery(request,accepted=>{settles++;expect(accepted).toBe(false);if(mode==="close-error")throw closeFailure;})).toBe(true);
      if(mode==="sync")throw providerFailure;
      return Promise.reject(providerFailure);
    }};
    await expect(voting(f,provider)).rejects.toBe(mode==="close-error"?closeFailure:providerFailure);
    expect(original!.context).toMatchObject({day:1,stage:"awakened_idiot_reveal_speech",allow_fallback:false,action_failure_policy:"error"});
    expect(nobleBodyRequestScope(f.world,original!)).toBeUndefined();
    expect(settles).toBe(1);
    expect(f.events.filter(e=>e.type==="secret_body_revealed")).toHaveLength(1);
    expect(f.events.filter(e=>e.type==="secret_body_reveal_speech")).toHaveLength(0);
    expect(checkpointNobleBodyAuthority(f.world,true).body.body).toEqual({kind:"exile_revealed",day:1});
    expect(checkpointNobleBodyAuthority(f.world,true).nights[0]).toMatchObject({revealOpened:true,revealCompleted:false});
    expect(f.world.getComponent(5,COMPONENT.Alive)!.alive).toBe(true);
  });

test("原await期间撤销current先拒绝，不进入网关或发言提交且关闭原请求", async () => {
  const f=fixture();let current=true,request:ActionRequest|undefined,settles=0;
  const provider:ActionProvider={async getAction(r){
    if(r.context.stage!=="awakened_idiot_reveal_speech")return vote;
    request=r;deferRequestDelivery(r,accepted=>{expect(accepted).toBe(false);settles++;});
    await Promise.resolve();current=false;
    return {name:"speak",args:{text:"不能在过期窗口发表。"}};
  }};
  await expect(voting(f,provider,()=>current)).rejects.toThrow("secret_body_reveal_speech_required");
  expect(nobleBodyRequestScope(f.world,request!)).toBeUndefined();
  expect(settles).toBe(1);
  expect(f.events.filter(e=>e.type==="secret_body_reveal_speech")).toHaveLength(0);
  expect(checkpointNobleBodyAuthority(f.world,true).nights[0]).toMatchObject({revealOpened:true,revealCompleted:false});
});
