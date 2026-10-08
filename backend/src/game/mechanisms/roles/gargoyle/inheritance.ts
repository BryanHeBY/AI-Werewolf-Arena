import {COMPONENT} from "../../../../core/domain/components/names";
import type {RoleComponent} from "../../../../core/domain/components/role";
import {Camp,Role,type GameEvent} from "../../../../core/domain/model";
import type {World} from "../../../../core/domain/world";
import {getGargoyleState} from "../private_state";
import {completedGargoyleInspection} from "../role_inspection/night_scope";

export function canGargoyleKnife(role:RoleComponent,world?:World):boolean{
 if(!world||role.role!==Role.Gargoyle||role.camp!==Camp.Wolf||getGargoyleState(role)?.hasInheritedKnife!==true||!completedGargoyleInspection(world,role))return false;
 const wolves=world.getAliveEntityIds().filter(id=>world.getComponent<RoleComponent>(id,COMPONENT.Role)?.camp===Camp.Wolf);
 return wolves.length===1&&world.getComponent(wolves[0]!,COMPONENT.Role)===role;
}
export function refreshGargoyleInheritance(world:World,events:GameEvent[],day:number):void{
 const wolves=world.getAliveEntityIds().filter(id=>world.getComponent<RoleComponent>(id,COMPONENT.Role)?.camp===Camp.Wolf);if(wolves.length!==1)return;
 const actorId=wolves[0]!,role=world.getComponent<RoleComponent>(actorId,COMPONENT.Role)!,state=role.role===Role.Gargoyle?getGargoyleState(role):undefined;if(!state||state.hasInheritedKnife)return;
 state.hasInheritedKnife=true;events.push({timestamp:Date.now(),type:"gargoyle_awakened",payload:{actorId,day}});
}
