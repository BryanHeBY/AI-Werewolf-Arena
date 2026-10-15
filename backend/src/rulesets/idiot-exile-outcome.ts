/**
 * 负责白痴放逐的完整免死结果组合。输入为原 World、目标和可写事件数组；输出为免死结果或 null。
 * 规则集先查询猎魔板子的原生审计，原生库存提交仍归猎魔权威；普通分支按翻牌、票权、警徽、事件原序写入。
 * 本模块不标死、推进阶段或授予租约；已写前缀遇后续错误不回滚，重复翻牌不恢复票权。
 */
import { commitDemonIdiotReveal, demonIdiotRevealed } from "../features/demon-hunter/reveal-ports";
import { AliveComponent } from "../domain/components/alive";
import { BadgeComponent } from "../domain/components/badge";
import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import { VotingRightComponent } from "../domain/components/voting-right";
import { EntityId, GameEvent, Role } from "../domain/model";
import { World } from "../domain/world";
import { VotedOutResult } from "../engine/hooks/registry";
import { transferOrDestroySheriffBadge } from "../features/sheriff/badge";
import { getIdiotState, setIdiotState } from "../features/idiot/ports";

/** 同步决定本次放逐是否免死；原生命、阶段与后续死亡提交仍归引擎。 */
export function idiotVotedOutHook(
  world: World,
  targetId: EntityId,
  events: GameEvent[],
): VotedOutResult | null {
  const roleComp = world.getComponent(targetId, COMPONENT.Role);
  const aliveComp = world.getComponent(targetId, COMPONENT.Alive);
  if (!roleComp || !aliveComp || !aliveComp.alive) {
    return null;
  }
  if (roleComp.role !== Role.Idiot) {
    return null;
  }
  // 原生板子的审计查询先行；只有 null/undefined 才回退普通状态，异常不吞。
  if (demonIdiotRevealed(world, targetId) ?? getIdiotState(roleComp)?.revealed) {
    return { prevented: true, removed: [], reason: "idiot_already_revealed" };
  }

  // 原生提交拥有私有库存和审计；普通分支先翻牌，再依次关闭票权、清零票重。
  if (!commitDemonIdiotReveal(world, targetId)) {
    setIdiotState(roleComp, { revealed: true });
    const voting = world.getComponent(targetId, COMPONENT.VotingRight);
    if (voting) {
      voting.canVote = false;
      voting.weight = 0;
    }
  }

  // 后续警徽或事件失败不会退款已写的翻牌和票权；重复调用直接返回已翻牌结果。
  const badge = world.getComponent(targetId, COMPONENT.Badge);
  if (badge?.isSheriff) {
    transferOrDestroySheriffBadge(world, targetId, "idiot_revealed", events);
  }

  events.push({
    timestamp: Date.now(),
    type: "idiot_revealed",
    payload: { targetId },
  });

  return {
    prevented: true,
    removed: [],
    reason: "idiot_revealed",
  };
}
