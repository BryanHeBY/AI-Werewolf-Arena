import {expect,test} from "bun:test";
import {bootstrapGame} from "../../../src/app/bootstrap";
import {Role,COMPONENT,StatusMark,DeathCause,type BoardConfig} from "../../../src/core";
import {sixPlayerMvpConfig} from "../../../src/runtime/scenarios/six_player_mvp";
import {captureNightLife,planMechanicalDamage,type NightMechanicalEffects,type NightPoisonClaim} from "../../../src/core/domain/night_effects";
import {StatusMarksComponent} from "../../../src/core/domain/components/status_marks";
import {createAliveComponent} from "../../../src/core/domain/components/alive";
import {DamageResolutionSystem} from "../../../src/core/domain/systems/damage_resolution_system";
import { permitsDeathShot } from "../../../src/core/domain/deaths";
const roles=[Role.Wolf,Role.Witch,Role.Seer,Role.Guard,Role.Villager,Role.Villager],config:BoardConfig={...sixPlayerMvpConfig,roleSetups:[...new Set(roles)].map(role=>({role,count:roles.filter(r=>r===role).length}))};
const fixture=()=>bootstrapGame(config,{fixedRoles:roles}),scope=(game:ReturnType<typeof fixture>,id:number)=>captureNightLife(game.world,id)!;
const effects=():{shields:NightMechanicalEffects["shields"][number][];attacks:NightMechanicalEffects["attacks"][number][];failures:NightMechanicalEffects["failures"][number][]}=>({shields:[],attacks:[],failures:[]});
const marks=(game:ReturnType<typeof fixture>,id:number,...values:StatusMark[])=>{const m=new StatusMarksComponent(values);game.world.addComponent(id,COMPONENT.StatusMarks,m);};
test("every claimed toxin is reflected once to its original source, with one merged death per current body",()=>{
 const game=fixture(),frame=effects();frame.shields.push({actorId:1,target:scope(game,5),isCurrent:()=>true});const claims:NightPoisonClaim[]=[{source:scope(game,2),target:scope(game,5)},{source:scope(game,3),target:scope(game,5)}];marks(game,5,StatusMark.PoisonMark);const plan=planMechanicalDamage(game.world,frame,claims);
 expect(plan.reflections).toEqual([{actorId:1,protectedTargetId:5,casterId:2},{actorId:1,protectedTargetId:5,casterId:3}]);expect([...plan.reflectedPoisonTargets]).toEqual([2,3]);expect(new DamageResolutionSystem().resolve(game.world,{mechanicalEffects:frame,poisonClaims:claims})).toEqual({deaths:[2,3],deathSources:{2:[DeathCause.Poison],3:[DeathCause.Poison]}});expect(game.world.getAliveEntityIds()).toEqual([1,2,3,4,5,6]);
});
test("reflection is not recursively fed through another mechanical shield; self-poison obeys the same one-reflection rule",()=>{
 for(const self of [false,true]){const game=fixture(),frame=effects(),caster=self?5:2;frame.shields.push({actorId:1,target:scope(game,5),isCurrent:()=>true},{actorId:4,target:scope(game,caster),isCurrent:()=>true});const poison=[{source:scope(game,caster),target:scope(game,5)}];marks(game,5,StatusMark.PoisonMark);expect(new DamageResolutionSystem().resolve(game.world,{mechanicalEffects:frame,poisonClaims:poison})).toEqual({deaths:[caster],deathSources:{[caster]:[DeathCause.Poison]}});}
});
test("Dream protects the reflected caster without returning the toxin to the shielded victim",()=>{
 const game=fixture(),frame=effects();frame.shields.push({actorId:1,target:scope(game,5),isCurrent:()=>true});marks(game,5,StatusMark.PoisonMark);expect(new DamageResolutionSystem().resolve(game.world,{mechanicalEffects:frame,poisonClaims:[{source:scope(game,2),target:scope(game,5)}],protectedTargets:[2]})).toEqual({deaths:[],deathSources:{}});
});
for(const change of ["caster_revive","target_revive","shield_cancel"] as const)test(`${change}: old source/target/effect scopes never move reflection to a new life`,()=>{
 const game=fixture(),frame=effects();let current=true;const poison=[{source:scope(game,2),target:scope(game,5)}];frame.shields.push({actorId:1,target:scope(game,5),isCurrent:()=>current});marks(game,5,StatusMark.PoisonMark);if(change==="shield_cancel")current=false;else game.world.addComponent(change==="caster_revive"?2:5,COMPONENT.Alive,createAliveComponent());const result=new DamageResolutionSystem().resolve(game.world,{mechanicalEffects:frame,poisonClaims:poison});expect(result).toEqual(change==="shield_cancel"?{deaths:[5],deathSources:{5:[DeathCause.Poison]}}:{deaths:[],deathSources:{}});
});
test("ordinary Guard plus Heal cancellation does not remove an independent mechanical shield",()=>{
 const game=fixture(),frame=effects();frame.shields.push({actorId:1,target:scope(game,5),isCurrent:()=>true});marks(game,5,StatusMark.GuardMark,StatusMark.HealMark,StatusMark.WolfKillMark);frame.attacks.push({actorId:1,target:scope(game,5),isCurrent:()=>true});expect(new DamageResolutionSystem().resolve(game.world,{mechanicalEffects:frame})).toEqual({deaths:[],deathSources:{}});
});
test("ordinary Guard and Heal cancel each other for an extra knife as well as the base knife", () => {
 for (const baseKnife of [false, true]) {
  const game = fixture(), frame = effects();
  frame.attacks.push({ actorId: 1, target: scope(game, 5), isCurrent: () => true });
  marks(game, 5, StatusMark.GuardMark, StatusMark.HealMark, ...(baseKnife ? [StatusMark.WolfKillMark] : []));
  expect(new DamageResolutionSystem().resolve(game.world, { mechanicalEffects: frame })).toEqual({
   deaths: [5], deathSources: { 5: baseKnife ? [DeathCause.WolfKill, DeathCause.MechanicalKnife] : [DeathCause.MechanicalKnife] },
  });
 }
});
for(const protection of ["guard","heal","dream","mechanical","none"] as const)test(`${protection}: an extra knife only pierces ordinary Guard`,()=>{
 const game=fixture(),frame=effects();frame.attacks.push({actorId:1,target:scope(game,5),isCurrent:()=>true});if(protection==="guard")marks(game,5,StatusMark.GuardMark);if(protection==="heal")marks(game,5,StatusMark.HealMark);if(protection==="mechanical")frame.shields.push({actorId:1,target:scope(game,5),isCurrent:()=>true});const result=new DamageResolutionSystem().resolve(game.world,{mechanicalEffects:frame,protectedTargets:protection==="dream"?[5]:[]});expect(result).toEqual(protection==="guard"||protection==="none"?{deaths:[5],deathSources:{5:[DeathCause.MechanicalKnife]}}:{deaths:[],deathSources:{}});
});
test("guard failure ignores protection and has its own non-shootable cause; old extra/failure scope is discarded",()=>{
 const game=fixture(),frame=effects();frame.failures.push({actorId:1,target:scope(game,1),isCurrent:()=>true});marks(game,1,StatusMark.GuardMark,StatusMark.HealMark);expect(new DamageResolutionSystem().resolve(game.world,{mechanicalEffects:frame,protectedTargets:[1]})).toEqual({deaths:[1],deathSources:{1:[DeathCause.MechanicalGuardFailure]}});
 const other=fixture(),old=scope(other,5),stale=effects();stale.attacks.push({actorId:1,target:old,isCurrent:()=>true});stale.failures.push({actorId:5,target:old,isCurrent:()=>true});other.world.addComponent(5,COMPONENT.Alive,createAliveComponent());expect(new DamageResolutionSystem().resolve(other.world,{mechanicalEffects:stale})).toEqual({deaths:[],deathSources:{}});
});
test("ordinary committed poison survives its caster's death or replacement when no mechanical shield intervenes", () => {
 for (const replacement of [false, true]) {
  const game = fixture();
  const poison = [{ source: scope(game, 2), target: scope(game, 5) }];
  marks(game, 5, StatusMark.PoisonMark);
  if (replacement) game.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
  else poison[0]!.source.life.alive = false;
  expect(new DamageResolutionSystem().resolve(game.world, { poisonClaims: poison })).toEqual({ deaths: [5], deathSources: { 5: [DeathCause.Poison] } });
 }
});
test("discarding a cancelled attack or failure leaves a separately accepted ordinary knife intact", () => {
 const game = fixture(), frame = effects();
 frame.attacks.push({ actorId: 1, target: scope(game, 5), isCurrent: () => false });
 frame.failures.push({ actorId: 1, target: scope(game, 1), isCurrent: () => false });
 marks(game, 5, StatusMark.WolfKillMark);
 expect(new DamageResolutionSystem().resolve(game.world, { mechanicalEffects: frame })).toEqual({ deaths: [5], deathSources: { 5: [DeathCause.WolfKill] } });
});
test("the extra knife permits a gun, but mechanical failure and any forbidden compound source do not", () => {
 expect(permitsDeathShot([DeathCause.MechanicalKnife])).toBe(true);
 expect(permitsDeathShot([DeathCause.MechanicalKnife, DeathCause.Exile])).toBe(true);
 expect(permitsDeathShot([DeathCause.MechanicalGuardFailure])).toBe(false);
 for (const forbidden of [DeathCause.Poison, DeathCause.Dream, DeathCause.Charm, DeathCause.Duel, DeathCause.Ability, DeathCause.MechanicalGuardFailure]) {
  expect(permitsDeathShot([DeathCause.MechanicalKnife, forbidden])).toBe(false);
 }
});
