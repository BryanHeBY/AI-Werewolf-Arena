/**
 * 临时记录两条真实 Demon 请求路径的原行为，不是生产政策或正常测试套件。
 * 每个输入各自 bootstrap 合法六人板、捕获真实工厂原请求，观察坏后恢复与原提交前缀。
 * 只断言探针确实到达原绑定/真实角色；恢复的真假和异常按实际结果输出，不预设新单调政策。
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const beforePath = "/tmp/awa-demon-request-recovery-characterization-before.json";
const before = JSON.parse(fs.readFileSync(beforePath, "utf8")), root = before.root;
const sha = b => createHash("sha256").update(b).digest("hex");
const args = process.argv.slice(2), option = (key, fallback) => {
  const at = args.indexOf(key); return at < 0 ? fallback : args[at + 1];
};
const wantedFamily = option("--family", "all"), wantedMode = option("--mode", "all");
const output = option("--out", "/tmp/awa-demon-request-recovery-characterization-result.json");
const families = ["hunt", "native_potion"], modes = ["body_stage", "context_reference", "domain_current", "observed_expiry_clock_rollback", "unknown_wrong_world", "registered_alias_context"];
assert(wantedFamily === "all" || families.includes(wantedFamily));
assert(wantedMode === "all" || modes.includes(wantedMode));
const verifyFence = () => {
  for (const row of before.linkedPublicSourceManifest) {
    const file = path.join(root, row.path), actual = fs.existsSync(file) ? sha(fs.readFileSync(file)) : null;
    assert.equal(actual, row.currentSHA256, "linked source changed: " + row.path);
  }
  for (const row of before.criticalSource) assert.equal(sha(fs.readFileSync(path.join(root,row.path))),row.sha256);
};
verifyFence();
const load = name => import(pathToFileURL(path.join(root, name)).href);
// 和现有真实 controller 测试相同，先加载公开 bootstrap，避免人为改变角色装配初始化路径。
const { bootstrapGame } = await load("backend/src/app/bootstrap.ts");
const core = await load("backend/src/core/index.ts");
const authority = await load("backend/src/game/mechanisms/roles/demon_hunter/authority.ts");
const native = await load("backend/src/game/mechanisms/roles/demon_hunter/native_potion_requests.ts");
const { executeDemonHunterTurn } = await load("backend/src/game/mechanisms/roles/demon_hunter/controller.ts");
const { executeDemonWitchTurn } = await load("backend/src/game/mechanisms/roles/demon_hunter/native_potion_controller.ts");
const { GameActionRequestFactory } = await load("backend/src/game/engine/action_request_factory.ts");
const { ToolGateway } = await load("backend/src/game/gateway/tool_gateway.ts");
const { findNightAbility } = await load("backend/src/game/mechanisms/roles/abilities.ts");
const { createRandom } = await load("backend/src/core/domain/random.ts");
const { Role, Camp, COMPONENT, WinCondition, WitchSelfHealRule, ActionWindow, PotionType, World } = core;
const errorView = error => ({ name:error?.name ?? typeof error, message:error?.message ?? String(error) });
const roles = [Role.Wolf,Role.Wolf,Role.Villager,Role.Seer,Role.Witch,Role.DemonHunter];
function fixture(label) {
  const config = {
    boardSize:6, enableSheriff:false,
    roleSetups:[{role:Role.Wolf,count:2},{role:Role.Villager,count:1},{role:Role.Seer,count:1},{role:Role.Witch,count:1},{role:Role.DemonHunter,count:1}],
    winConditions:[WinCondition.SlaughterCity],
    hooks:{onPreElection:true,onPreVote:true,onDaybreak:false,onPerSpeechGap:false},
    selfDestruct:{enabledWindows:[ActionWindow.OnPreElection,ActionWindow.OnPreVote]},
    witch:{canSelfHeal:WitchSelfHealRule.Disabled,knifeVisibility:"awa_with_heal_v1",potionPolicy:"awa_one_native_v1"},
    seer:{targetPolicy:"awa_alive_v1",actionPolicy:"awa_required_when_legal_v1"},
    tieBreaker:{wolfKillVote:"min_id",exileVote:"min_id"}, voting:{exilePolicy:"awa_direct_v1"},
    disclosure:{deathRevealPolicy:"awa_hidden_v1"},lastWords:{policy:"awa_initial_wave_v1"},
    demonHunter:{policy:"awa_netease_demon_hunter_v1"},
  };
  const game = bootstrapGame(config,{fixedRoles:roles,locale:"zh-CN",random:createRandom("demon-recovery-probe/"+label)});
  assert.equal(game.boardConfig,game.parameters.board);
  assert.deepEqual(game.world.entityIds().map(id=>game.world.getComponent(id,COMPONENT.Role).role),roles);
  assert.deepEqual(game.world.entityIds().map(id=>game.world.getComponent(id,COMPONENT.Camp).camp),[Camp.Wolf,Camp.Wolf,Camp.Good,Camp.Good,Camp.Good,Camp.Good]);
  return { ...game, events:[], current:true, demon:game.world.getComponent(6,COMPONENT.Role), witch:game.world.getComponent(5,COMPONENT.Role) };
}
function snapshot(f) {
  const ability = findNightAbility(f.witch,"potion","native:potion");
  return {
    huntHistory:structuredClone(f.demon.privateState.demonHunter.history),
    witchStock:ability ? { id:ability.id,heal:ability.state.heal,poison:ability.state.poison,uses:ability.uses,lastUsedDay:ability.lastUsedDay,healUsedThisNight:ability.state.healUsedThisNight,poisonUsedThisNight:ability.state.poisonUsedThisNight } : null,
    witchAudit:structuredClone(authority.demonHunterAuditPlayer(f.world,5)),
    alive:f.world.getAliveEntityIds(),
    targetMarks:f.world.getComponent(1,COMPONENT.StatusMarks)?.values() ?? [],
    events:structuredClone(f.events),
  };
}
async function run(family, mode) {
  const row={family,mode,providerEntered:false,observations:[],settlements:[],gatewayCalls:[]};
  const f=fixture(family+"/"+mode), day=family==="hunt"?2:1;
  authority.beginDemonHunterNight(f.world,day,()=>f.current);
  let request, originalContext, scope, providerFailure, providerFailureError;
  const query=(world,req)=>family==="hunt"?authority.demonHunterRequestScope(world,req):native.demonWitchRequestCurrent(world,req);
  const delivery=req=>{try{core.assertRequestDelivery(req);return {ok:true};}catch(error){return {ok:false,error:errorView(error)};}};
  const observe=(label,req=request)=>{
    try {
      const actual=query(f.world,req), value={label,current:family==="hunt"?actual!==undefined:actual,scopeSame:family==="hunt"?actual===scope:null,delivery:delivery(req)};
      row.observations.push(value);return value;
    } catch(error) {const value={label,queryError:errorView(error)};row.observations.push(value);return value;}
  };
  const gateway=new ToolGateway(), originalValidate=gateway.validateAndSanitize;
  gateway.validateAndSanitize=function(...input){
    try {const value=Reflect.apply(originalValidate,this,input);row.gatewayCalls.push({ok:value.ok,sanitizedCall:structuredClone(value.sanitizedCall??null)});return value;}
    catch(error){row.gatewayCalls.push({error:errorView(error)});throw error;}
  };
  const construction={get requestFactory(){return GameActionRequestFactory;}};
  const provider={async getAction(actual){
    row.providerEntered=true;request=actual;originalContext=actual.context;scope=query(f.world,actual);
    assert.equal(family==="hunt"?scope!==undefined:scope===true,true,"original factory request must already be bound");
    assert.equal(actual.context.day,day);assert.equal(actual.context.stage,family==="hunt"?"demon_hunter":"witch");
    assert.equal(core.deferRequestDelivery(actual,accepted=>row.settlements.push(accepted)),true);
    row.initial=snapshot(f);row.originalRequest=structuredClone(actual);observe("original_before");
    const oldNow=Date.now;
    try {
      if(mode==="body_stage") {
        const stage=actual.context.stage;actual.context.stage="probe_invalid_stage";
        observe("original_bad_stage");actual.context.stage=stage;observe("original_restored_stage");
      } else if(mode==="context_reference") {
        actual.context={...originalContext};observe("original_replaced_equal_context");
        actual.context=originalContext;observe("original_restored_context_ref");
      } else if(mode==="domain_current") {
        f.current=false;observe("original_domain_false");f.current=true;observe("original_domain_restored");
      } else if(mode==="observed_expiry_clock_rollback") {
        const now=oldNow(),deadline=now+60000,alias=core.deriveBoundedRequest(actual,deadline);
        row.clockInput={before:now,aliasDeadline:deadline,expiryObservation:deadline+1,rollback:now,originalDeadlineAtMs:actual.deadlineAtMs??null};
        assert.equal(observe("registered_short_alias_before",alias).current,true,"legal bounded alias must bind");
        Date.now=()=>deadline+1;observe("original_after_observed_expiry");observe("alias_after_observed_expiry",alias);
        Date.now=()=>now;observe("original_after_clock_rollback");observe("alias_after_clock_rollback",alias);
      } else if(mode==="unknown_wrong_world") {
        const wrongWorld=new World("en"),unknown={...actual};
        const foreign=query(wrongWorld,actual),copied=query(f.world,unknown);
        row.isolation={wrongWorldRejected:family==="hunt"?foreign===undefined:foreign===false,unknownCloneRejected:family==="hunt"?copied===undefined:copied===false};
        observe("original_after_wrong_world_unknown_queries");
      } else if(mode==="registered_alias_context") {
        const alias=core.deriveBoundedRequest(actual,oldNow()+60000),context=alias.context;
        assert.equal(observe("registered_alias_before",alias).current,true,"legal bounded alias must bind");alias.context={...context};
        observe("alias_replaced_equal_context",alias);observe("original_while_alias_context_bad");
        alias.context=context;observe("alias_restored_context_ref",alias);observe("original_after_alias_restore");
      }
      row.beforeReply=snapshot(f);row.contextOriginalReference=actual.context===originalContext;
      observe("original_before_provider_return");
    } catch(error) {providerFailure=errorView(error);providerFailureError=error;throw error;}
    finally {Date.now=oldNow;f.current=true;actual.context=originalContext;}
    return family==="hunt"?{name:"demon_hunt",args:{target_id:1,abstain:false}}:{name:"use_potion",args:{target_id:1,potion_type:PotionType.Poison}};
  }};
  try {
    const result=family==="hunt"
      ?await executeDemonHunterTurn({world:f.world,gateway,events:f.events,provider,day,construction})
      :await executeDemonWitchTurn({world:f.world,gateway,events:f.events,provider,day,wolfTarget:3,construction});
    row.controller={returned:true,result:family==="hunt"?structuredClone(result):{used:result.used,hasPoison:result.poison!==null,paidPoisonCurrent:result.poison?.claim.isCurrent?.()??null}};
  } catch(error) {row.controller={returned:false,error:errorView(error),sameAsProviderError:providerFailureError===error};}
  finally {
    row.providerFailure=providerFailure??null;row.final=snapshot(f);
    if(request){observe("original_after_controller_finally");row.originalContextRestored=request.context===originalContext;}
    authority.closeDemonHunterNight(f.world);
  }
  return row;
}
const result={purpose:"Only original-behavior characterization; no future-policy oracle or production fix",baseCommit:before.baseCommit,actualRunHead:execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),beforeSHA256:sha(fs.readFileSync(beforePath)),scriptSHA256:sha(fs.readFileSync(new URL(import.meta.url))),rows:[],preparationOnly:false};
let fixtureFailures=0;
for(const family of families.filter(x=>wantedFamily==="all"||x===wantedFamily)) {
  for(const mode of modes.filter(x=>wantedMode==="all"||x===wantedMode)) {
    try {const row=await run(family,mode);if(!row.providerEntered||row.providerFailure)fixtureFailures++;result.rows.push(row);}
    catch(error){fixtureFailures++;result.rows.push({family,mode,fixtureError:errorView(error)});}
  }
}
verifyFence();
result.fixtureFailures=fixtureFailures;
result.limits=["Each family/mode uses a fresh canonical bootstrap World and original request; no old test title is executed.","Records real authority queries plus delivery errors and actual controller/factory/gateway completion; recovery booleans are observations, not new permanent test expectations.","Hunt controller returns its choice but does not publish night_stages' choice event; native controller publishes the actual potion event. No full NightPipeline or paid-effect matrix coverage is claimed.","Registered alias-only behavior is recorded separately from original/shared-context/domain/deadline behavior; no alias policy is inferred.","No active session recorder is installed; committed participant audit/stock/history/event prefixes are read, not a claim of end-to-end recorded Tape.","Clock changes are local explicit inputs restored before provider returns and in finally; observed expiry and rollback are separate from changing original deadline fields."];
fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result));
if(fixtureFailures)process.exitCode=1;
