import {AliveComponent,aliveLifeVersion} from "../../../../core/domain/components/alive";
import {COMPONENT} from "../../../../core/domain/components/names";
import type {RoleComponent} from "../../../../core/domain/components/role";
import type {IdentityComponent} from "../../../../core/domain/entities/player";
import {Camp,Role,type GameEvent,type EntityId} from "../../../../core/domain/model";
import type {World} from "../../../../core/domain/world";
import {RoleCatalog,getDefaultRoleCatalog} from "../catalog";
import {getBearState,type BearState} from "../private_state";

/** The snapshot stays with the manager, never on a player component or DTO. */
export class BearNightFrame{
 private constructor(private readonly owner:World,private readonly day:number,private readonly actorId:EntityId,private readonly role:RoleComponent,private readonly state:BearState,private readonly life:AliveComponent,private readonly lifeVersion:number,private readonly wasAlive:boolean,private readonly sampledRoar:boolean){}

 static capture(world:World,day:number,catalog:RoleCatalog=getDefaultRoleCatalog()):BearNightFrame|null{
  const bears=world.entityIds().filter(id=>world.getComponent<RoleComponent>(id,COMPONENT.Role)?.role===Role.Bear);
  if(bears.length>1)throw new Error("bear_count_exceeds_limit");
  const actorId=bears[0];if(actorId===undefined)return null;
  const role=world.getComponent<RoleComponent>(actorId,COMPONENT.Role)!,state=getBearState(role),life=world.getComponent<AliveComponent>(actorId,COMPONENT.Alive),version=life&&aliveLifeVersion(life);
  if(role.camp!==Camp.Good||!state||!life||version===undefined)return null;
  const ring=world.getAliveEntityIds().sort((a,b)=>(world.getComponent<IdentityComponent>(a,COMPONENT.Identity)?.seat??a)-(world.getComponent<IdentityComponent>(b,COMPONENT.Identity)?.seat??b)||a-b),index=ring.indexOf(actorId);
  const neighbors=index<0||ring.length<2?[]:[...new Set([ring[(index+ring.length-1)%ring.length],ring[(index+1)%ring.length]])];
  const roared=neighbors.some(id=>{const target=world.getComponent<RoleComponent>(id,COMPONENT.Role);return target?.camp===Camp.Wolf&&(catalog.get(target.role)?.detectableByBear?.(world,target)??true);});
  return new BearNightFrame(world,day,actorId,role,state,life,version,life.alive,roared);
 }

 /** Publish after the complete night death wave and before its victory check. */
 publish(world:World,events:GameEvent[],isCurrent:()=>boolean):void{
  if(world!==this.owner||!isCurrent()||world.getComponent(this.actorId,COMPONENT.Role)!==this.role||this.role.role!==Role.Bear||this.role.camp!==Camp.Good||getBearState(this.role)!==this.state||world.getComponent(this.actorId,COMPONENT.Alive)!==this.life||aliveLifeVersion(this.life)!==this.lifeVersion+(this.wasAlive&&!this.life.alive?1:0)||this.state.history.some(report=>report.day===this.day))return;
  const report={day:this.day,roared:this.life.alive&&this.wasAlive&&this.sampledRoar};
  this.state.history.push(report);events.push({timestamp:Date.now(),type:"bear_roared",payload:{...report}});
 }
}
