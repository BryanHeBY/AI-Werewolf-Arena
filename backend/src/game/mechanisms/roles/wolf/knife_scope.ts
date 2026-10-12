/**
 * Checks the sourced wolf knife and discards it when its original life or mark scope is stale.
 * Inputs are World and the captured knife claim; outputs clear the captured and current knife
 * marks and reset the night target. It does not create a replacement attack or kill a revived
 * target. The public target query remains after the original life/marks checks.
 */
import { bindWolfKnifeTargetQuery } from "./ports";
import { aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import { StatusMark } from "../../../../core/domain/model";
import type { StatusMarksComponent } from "../../../../core/domain/components/status_marks";
import type { World } from "../../../../core/domain/world";
import type { NightStageState } from "../../stages/night/contracts";

/** Historical accepted ballots remain recorded; their knife cannot harm a new life. */
export function discardStaleWolfKnife(world: World, state: NightStageState): void {
  const scope = state.wolfTargetScope;
  if (!scope) return;
  if (
    world.getComponent(scope.targetId, COMPONENT.Alive) === scope.life &&
    scope.life.alive &&
    aliveLifeVersion(scope.life) === scope.version &&
    world.getComponent(scope.targetId, COMPONENT.StatusMarks) === scope.marks &&
    bindWolfKnifeTargetQuery(world).allows(scope.targetId)
  )
    return;
  scope.marks.remove(StatusMark.WolfKillMark);
  world.getComponent(scope.targetId, COMPONENT.StatusMarks)?.remove(StatusMark.WolfKillMark);
  state.wolfTarget = null;
  state.wolfTargetScope = undefined;
}
