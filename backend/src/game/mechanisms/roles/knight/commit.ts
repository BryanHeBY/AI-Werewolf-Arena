/**
 * 负责骑士决斗的本族资源消耗、公共事实和死亡提案。输入为原 World、所选编号、阶段与事件数组；
 * 输出为命中／未中提案或 null。按原序核角色、库存、双方存活和目标真实阵营，不以查验伪装代替阵营。
 * 先消费已读取的库存，再发表公共事件，后项失败保已写前缀；不标死、不推进日期或恢复资源。
 * 请求／窗口的原体复验仍由调用方持有，本函数不另建租约或缓存。
 */
import {
  Role,
  Camp,
  Phase,
  DeathCause,
  type KnightDuelSelection,
  type DeathSources,
  type GameEvent,
} from "../../../../domain/model";
import { COMPONENT } from "../../../../domain/components/names";
import type { RoleComponent } from "../../../../domain/components/role";
import type { World } from "../../../../domain/world";
import { getKnightState, consumeKnightDuel } from "./state";

/** 只提交一次库存和事实并返回死亡提案；真正的生命写入仍由死亡结算器负责。 */
export function commitKnightDuel(
  world: World,
  choice: KnightDuelSelection,
  phase: Phase,
  events: GameEvent[],
): { deaths: number[]; sources: DeathSources; endsDay: boolean } | null {
  if (phase !== Phase.Day || choice.actorId === choice.targetId) return null;
  const actor = world.getComponent(choice.actorId, COMPONENT.Role),
    target = world.getComponent(choice.targetId, COMPONENT.Role);
  const state = actor ? getKnightState(actor) : undefined;
  if (
    actor?.role !== Role.Knight ||
    state?.canDuel !== true ||
    !target ||
    !world.getComponent(choice.actorId, COMPONENT.Alive)?.alive ||
    !world.getComponent(choice.targetId, COMPONENT.Alive)?.alive
  )
    return null;
  const hit = world.getComponent(choice.targetId, COMPONENT.Camp)?.camp === Camp.Wolf;
  // 使用本次已读的同一个槽；资源 setter 失败先于发表，发表失败不退还已付资源。
  consumeKnightDuel(state);
  events.push({
    timestamp: Date.now(),
    type: "knight_duel",
    payload: {
      actorId: choice.actorId,
      targetId: choice.targetId,
      result: hit ? "wolf" : "not_wolf",
    },
  });
  return hit
    ? {
        deaths: [choice.targetId],
        sources: { [choice.targetId]: [DeathCause.Duel] },
        endsDay: true,
      }
    : {
        deaths: [choice.actorId],
        sources: { [choice.actorId]: [DeathCause.DuelFailure] },
        endsDay: false,
      };
}
