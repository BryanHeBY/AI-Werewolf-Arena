import {expect,test} from "bun:test";
import {bootstrapGame} from "../../../src/app/bootstrap";
import {Role,Phase,COMPONENT,DeathCause,type RoleComponent,type GameEvent,type BoardConfig} from "../../../src/core";
import {sixPlayerMvpConfig} from "../../../src/runtime/scenarios/six_player_mvp";
import {DeathResolution} from "../../../src/game/engine/death_resolution";
import {EventRegistry} from "../../../src/game/engine/event_registry";
import {HookRegistry} from "../../../src/game/mechanisms/hooks/hook_registry";
import {hunterDeathHook} from "../../../src/game/mechanisms/roles/hunter/death_hook";
import {ToolGateway} from "../../../src/game/gateway/tool_gateway";
import {createAliveComponent} from "../../../src/core/domain/components/alive";
import {captureNightLife} from "../../../src/core/domain/night_effects";
import {getHunterState} from "../../../src/game/mechanisms/roles/private_state";
const roles=[Role.Wolf,Role.Hunter,Role.Seer,Role.Guard,Role.Villager,Role.Villager],config:BoardConfig={...sixPlayerMvpConfig,roleSetups:[...new Set(roles)].map(role=>({role,count:roles.filter(r=>r===role).length}))};
const fixture=()=>bootstrapGame(config,{fixedRoles:roles}),role=(game:ReturnType<typeof fixture>,id:number)=>game.world.getComponent<RoleComponent>(id,COMPONENT.Role)!;
for(const change of ["revive","replace"] as const)test(`${change}: every old shot request is rejected without consuming the gun or publicly killing a new target life`,async()=>{
 const game=fixture(),events:GameEvent[]=[];let requests=0;
 await new DeathResolution(game.world,events,new ToolGateway(),new EventRegistry(),{day:1,phase:Phase.Day,gameOver:false,result:null}).resolve([2],{2:[DeathCause.WolfKill]},{async getAction(request){if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};requests++;if(change==="replace")game.world.addComponent(5,COMPONENT.Alive,createAliveComponent());else{const life=game.world.getComponent<{alive:boolean}>(5,COMPONENT.Alive)!;life.alive=false;life.alive=true;}return{name:"shoot",args:{target_id:5}};}},Phase.Night,Phase.Day);
 expect(requests).toBe(3);expect(game.world.getAliveEntityIds()).toEqual([1,3,4,5,6]);expect(getHunterState(role(game,2))!.canShoot).toBe(true);expect(events.some(e=>e.type==="hunter_shot")).toBe(false);
});
test("a new retry request can bind the current new life after the first reply was correctly rejected",async()=>{
 const game=fixture(),events:GameEvent[]=[];let requests=0;
 await new DeathResolution(game.world,events,new ToolGateway(),new EventRegistry(),{day:1,phase:Phase.Day,gameOver:false,result:null}).resolve([2],{2:[DeathCause.WolfKill]},{async getAction(request){if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};if(++requests===1)game.world.addComponent(5,COMPONENT.Alive,createAliveComponent());return{name:"shoot",args:{target_id:5}};}},Phase.Night,Phase.Day);
 expect(requests).toBe(2);expect(game.world.getAliveEntityIds()).toEqual([1,3,4,6]);expect(getHunterState(role(game,2))!.canShoot).toBe(false);expect(events.filter(e=>e.type==="hunter_shot").map(e=>e.payload)).toEqual([{hunterId:2,targetId:5}]);
});
test("gateway target replacement cannot turn an accepted numeric ID into a new-life shot",async()=>{
 const game=fixture(),events:GameEvent[]=[],gateway=new ToolGateway(),validate=gateway.validateAndSanitize.bind(gateway);let requests=0;
 gateway.validateAndSanitize=(...args)=>{const result=validate(...args);if(args[2].name==="shoot")game.world.addComponent(5,COMPONENT.Alive,createAliveComponent());return result;};
 await new DeathResolution(game.world,events,gateway,new EventRegistry(),{day:1,phase:Phase.Day,gameOver:false,result:null}).resolve([2],{2:[DeathCause.WolfKill]},{async getAction(request){if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};requests++;return{name:"shoot",args:{target_id:5}};}},Phase.Night,Phase.Day);
 expect(requests).toBe(3);expect(game.world.getAliveEntityIds()).toContain(5);expect(getHunterState(role(game,2))!.canShoot).toBe(true);expect(events.some(e=>e.type==="hunter_shot")).toBe(false);
});
for(const otherSource of [false,true])test(`${otherSource}: an invalid pending Shot does not produce public death or erase a separately valid death source`,async()=>{
 const game=fixture(),events:GameEvent[]=[],scope=captureNightLife(game.world,5)!;game.world.addComponent(5,COMPONENT.Alive,createAliveComponent());
 const registry=new EventRegistry(new HookRegistry([],[async(_world,ids)=>ids.includes(2)?{extraDeaths:[5],extraDeathSources:{5:otherSource?[DeathCause.Shot,DeathCause.Ability]:[DeathCause.Shot]},pendingShots:[{targetScope:scope,event:{timestamp:1,type:"hunter_shot",payload:{hunterId:2,targetId:5}}}]}:{extraDeaths:[],extraDeathSources:{}}]));
 await new DeathResolution(game.world,events,new ToolGateway(),registry,{day:1,phase:Phase.Day,gameOver:false,result:null}).resolve([2],{2:[DeathCause.WolfKill]},{async getAction(){return{name:"speak",args:{text:"Raw"}};}},Phase.Night,Phase.Day);
 expect(game.world.getAliveEntityIds().includes(5)).toBe(!otherSource);expect(events.filter(e=>e.type==="additional_deaths").map(e=>e.payload)).toEqual(otherSource?[{deaths:[5]}]:[]);expect(events.some(e=>e.type==="hunter_shot")).toBe(false);expect(JSON.stringify(events)).not.toContain('"life"');
});
test("a accepted shot invalidated between hook completion and actual owner commit preserves consumption but emits no false public hit",async()=>{
 const game=fixture(),events:GameEvent[]=[];
 const registry=new EventRegistry(new HookRegistry([],[async(...args)=>{const result=await hunterDeathHook(...args);if(result.pendingShots?.length)game.world.addComponent(5,COMPONENT.Alive,createAliveComponent());return result;}]));
 await new DeathResolution(game.world,events,new ToolGateway(),registry,{day:1,phase:Phase.Day,gameOver:false,result:null}).resolve([2],{2:[DeathCause.WolfKill]},{async getAction(request){return request.allowedTools.includes("shoot")?{name:"shoot",args:{target_id:5}}:{name:"speak",args:{text:"Raw"}};}},Phase.Night,Phase.Day);
 expect(getHunterState(role(game,2))!.canShoot).toBe(false);expect(game.world.getAliveEntityIds()).toContain(5);expect(events.some(e=>e.type==="hunter_shot")).toBe(false);
});
for(const change of ["actor_revive","actor_replace","clock","accepted_clock"] as const)test(`${change}: original death permit stays bound and cleanup preserves only legitimately consumed prefixes`,async()=>{
 const game=fixture(),events:GameEvent[]=[],state={day:1,phase:Phase.Day,gameOver:false,result:null},gateway=new ToolGateway(),original=getHunterState(role(game,2))!;
 const registry=change==="accepted_clock"?new EventRegistry(new HookRegistry([],[async(...args)=>{const result=await hunterDeathHook(...args);if(result.pendingShots?.length)state.phase=Phase.Voting;return result;}])):new EventRegistry();
 if(change==="actor_replace"){const validate=gateway.validateAndSanitize.bind(gateway);gateway.validateAndSanitize=(...args)=>{const result=validate(...args);if(args[2].name==="shoot")game.world.addComponent(2,COMPONENT.Alive,createAliveComponent(false));return result;};}
 await new DeathResolution(game.world,events,gateway,registry,state).resolve([2],{2:[DeathCause.WolfKill]},{async getAction(request){if(request.allowedTools.includes("shoot")){if(change==="actor_revive"){const life=game.world.getComponent<{alive:boolean}>(2,COMPONENT.Alive)!;life.alive=true;life.alive=false;}if(change==="clock")state.phase=Phase.Voting;return{name:"shoot",args:{target_id:5}};}return{name:"speak",args:{text:"Raw"}};}},Phase.Night,Phase.Day);
 expect(original.canShoot).toBe(change!=="accepted_clock");expect(game.world.getAliveEntityIds()).toContain(5);expect(events.some(e=>e.type==="hunter_shot")).toBe(false);expect(game.world.activeDeathActionCount).toBe(0);
});
test("legacy direct hook callers without a target scope still bind the target life before choose",async()=>{
 const game=fixture(),events:GameEvent[]=[];game.world.getComponent<{alive:boolean}>(2,COMPONENT.Alive)!.alive=false;const permit=game.world.openDeathAction(2,"shoot",Phase.Day,1);
 try{const result=await hunterDeathHook(game.world,[2],{2:[DeathCause.Exile]},async()=>{game.world.addComponent(5,COMPONENT.Alive,createAliveComponent());return{kind:"shot",targetId:5,deathActionId:permit.id};},events);expect(result.extraDeaths).toEqual([]);expect(events).toEqual([]);expect(getHunterState(role(game,2))!.canShoot).toBe(true);}
 finally{permit.close();}expect(game.world.activeDeathActionCount).toBe(0);
});
