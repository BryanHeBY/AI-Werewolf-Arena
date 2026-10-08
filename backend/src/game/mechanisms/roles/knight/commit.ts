import {Role,Camp,Phase,DeathCause,type KnightDuelSelection,type DeathSources,type GameEvent} from "../../../../core/domain/model";
import {COMPONENT} from "../../../../core/domain/components/names";
import type {RoleComponent} from "../../../../core/domain/components/role";
import type {World} from "../../../../core/domain/world";
import {getKnightState} from "../private_state";

/** One Knight resource/public fact/death proposal; never writes Alive or advances the phase. */
export function commitKnightDuel(world:World,choice:KnightDuelSelection,phase:Phase,events:GameEvent[]):{deaths:number[];sources:DeathSources;endsDay:boolean}|null{
 if(phase!==Phase.Day||choice.actorId===choice.targetId)return null;
 const actor=world.getComponent<RoleComponent>(choice.actorId,COMPONENT.Role),target=world.getComponent<RoleComponent>(choice.targetId,COMPONENT.Role);
 const state=actor?getKnightState(actor):undefined;
 if(actor?.role!==Role.Knight||state?.canDuel!==true||!target||!world.getComponent<{alive:boolean}>(choice.actorId,COMPONENT.Alive)?.alive||!world.getComponent<{alive:boolean}>(choice.targetId,COMPONENT.Alive)?.alive)return null;
 const hit=target.camp===Camp.Wolf;
 state.canDuel=false;
 events.push({timestamp:Date.now(),type:"knight_duel",payload:{actorId:choice.actorId,targetId:choice.targetId,result:hit?"wolf":"not_wolf"}});
 return hit?{deaths:[choice.targetId],sources:{[choice.targetId]:[DeathCause.Duel]},endsDay:true}:{deaths:[choice.actorId],sources:{[choice.actorId]:[DeathCause.DuelFailure]},endsDay:false};
}
