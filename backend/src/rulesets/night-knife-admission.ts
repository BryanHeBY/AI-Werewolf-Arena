/**
 * 负责夜阶段前／后及伤害前的两种狼刀现场准入与过期清理。输入为原 World、stageState、婚约归属和日期的延迟读取；
 * 输出为原标记移除和目标清空，普通狼刀先执行，婚约存在才读取第二组参数。各子步骤 return 只结束本步。
 * 普通刀保原生命／版本／标记／目标政策，先移原 marks 再移现场 marks，随后才清 stage；婚约刀仅移原 marks。
 * 中途失败保原已写前缀，不补新刀、付款、回滚或关闭。运行 thunks 和 scope 引用不是 JSON、快照或行动许可。
 * 本组合不增加 await、current 检查或清理守卫；原投票、目标查询和婚约权威仍拥有各自政策与资源。
 */
import { bindWolfKnifeTargetQuery } from "../features/wolf/ports";
import { weddingKnifeCurrent } from "../features/ghost-bride/ports";
import { aliveLifeVersion } from "../domain/components/alive";
import { COMPONENT } from "../domain/components/names";
import { StatusMark } from "../domain/model";
import type { World } from "../domain/world";
import type { NightStageState } from "../engine/night/contracts";

/** 仅持有原表达式的延迟读取，不能序列化、预读或将阶段声明当作提交许可。 */
export interface NightKnifeAdmissionRuntime {
  readonly world: () => World;
  readonly state: () => NightStageState;
  readonly ownsWedding: () => boolean;
  readonly day: () => number;
}

/** 原普通刀历史票仍已记录；过期刀按原生命／marks／目标政策撤下，不伤害新生命。 */
function discardStaleWolfKnife(world: World, state: NightStageState): void {
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

/** 婚约只复验原权威；即使当前 scope 为空，调用方仍先读取原 world／day／state 参数。 */
function discardStaleWeddingKnife(world: World, day: number, state: NightStageState): void {
  const scope = state.wolfTargetScope;
  if (!scope || weddingKnifeCurrent(world, day, scope.targetId)) return;
  scope.marks.remove(StatusMark.WolfKillMark);
  state.wolfTarget = null;
  state.wolfTargetScope = undefined;
}

/** 固定两个独立步骤的原先后顺序；前步无刀 return 不跳过婚约条件，false 不读取婚约参数。 */
export function discardStaleNightKnives(runtime: NightKnifeAdmissionRuntime): void {
  discardStaleWolfKnife(runtime.world(), runtime.state());
  if (runtime.ownsWedding()) discardStaleWeddingKnife(runtime.world(), runtime.day(), runtime.state());
}
