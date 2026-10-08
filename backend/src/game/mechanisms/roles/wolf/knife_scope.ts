import {aliveLifeVersion} from "../../../../core/domain/components/alive";
import {COMPONENT} from "../../../../core/domain/components/names";
import {StatusMark} from "../../../../core/domain/model";
import type {StatusMarksComponent} from "../../../../core/domain/components/status_marks";
import type {World} from "../../../../core/domain/world";
import type {NightStageState} from "../../stages/night/contracts";

/** Historical accepted ballots remain recorded; their knife cannot harm a new life. */
export function discardStaleWolfKnife(world:World,state:NightStageState):void{
 const scope=state.wolfTargetScope;if(!scope)return;
 if(world.getComponent(scope.targetId,COMPONENT.Alive)===scope.life&&scope.life.alive&&aliveLifeVersion(scope.life)===scope.version&&world.getComponent(scope.targetId,COMPONENT.StatusMarks)===scope.marks)return;
 scope.marks.remove(StatusMark.WolfKillMark);
 world.getComponent<StatusMarksComponent>(scope.targetId,COMPONENT.StatusMarks)?.remove(StatusMark.WolfKillMark);
 state.wolfTarget=null;state.wolfTargetScope=undefined;
}
