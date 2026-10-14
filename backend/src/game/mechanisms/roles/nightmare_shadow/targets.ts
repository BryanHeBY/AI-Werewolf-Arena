/**
 * 负责噩梦之影原恐惧目标政策，供请求、校验、基线策略与提示共用同一候选算法。
 * 输入是原 World、演员序号和日期；输出保留原现场候选读取、禁选自身／相邻夜重复及狼同伴规则。
 * 原状态／存活与日期检查按原顺序短路；候选不是许可，此模块不写历史、打开夜窗口或支付资源。
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import { Camp, type EntityId } from "../../../../core/domain/identity";
import type { World } from "../../../../core/domain/world";
import { getNightmareShadowState, nightmareStateDayValid } from "./state-slot";

/** 请求、校验、基线策略与目标提示使用同一目标政策，避免相邻两夜的禁选规则漂移。 */
export function nightmareFearTargets(world: World, actorId: EntityId, day: number): EntityId[] {
  const state = getNightmareShadowState(world.getComponent(actorId, COMPONENT.Role), () => world.getComponent(actorId, COMPONENT.Camp));
  if (
    !state ||
    !nightmareStateDayValid(day) ||
    !world.getAliveEntityIds().includes(actorId) ||
    (day > 1 && !state.packReady) ||
    (state.lastDay !== null && day <= state.lastDay)
  )
    return [];
  return world.getAliveEntityIds().filter((id) => {
    if (id === actorId || (state.lastDay === day - 1 && state.lastTarget === id)) return false;
    const target = world.getComponent(id, COMPONENT.Role);
    return !!target && (!state.packReady || world.getComponent(id, COMPONENT.Camp)?.camp !== Camp.Wolf);
  });
}
