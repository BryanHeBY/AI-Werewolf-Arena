/** 文件说明：警徽流转与销毁逻辑。 */
import { AliveComponent } from "../../domain/components/alive";
import { BadgeComponent } from "../../domain/components/badge";
import { COMPONENT } from "../../domain/components/names";
import { VotingRightComponent } from "../../domain/components/voting_right";
import { IdentityComponent } from "../../domain/entities/player";
import { EntityId, GameEvent } from "../../domain/model";
import { World } from "../../domain/world";

/**
 * 警徽流转处理结果。
 */
export interface SheriffBadgeTransferResult {
  fromId: EntityId;
  toId: EntityId | null;
  destroyed: boolean;
}

/**
 * 警徽流转处理：
 * - 优先移交给下一位“存活且有投票权”的玩家；
 * - 若无可移交对象，则销毁警徽。
 */
export function transferOrDestroySheriffBadge(
  world: World,
  fromId: EntityId,
  reason: string,
  events: GameEvent[],
): SheriffBadgeTransferResult | null {
  const badge = world.getComponent<BadgeComponent>(fromId, COMPONENT.Badge);
  if (!badge?.isSheriff) {
    return null;
  }

  badge.isSheriff = false;
  badge.destroyed = true;
  resetVotingWeight(world, fromId);

  const nextSheriffId = pickNextSheriffCandidate(world, fromId);
  if (nextSheriffId === null) {
    events.push({
      timestamp: Date.now(),
      type: "sheriff_badge_destroyed",
      payload: {
        targetId: fromId,
        reason,
      },
    });
    return {
      fromId,
      toId: null,
      destroyed: true,
    };
  }

  const nextBadge = world.getComponent<BadgeComponent>(nextSheriffId, COMPONENT.Badge);
  if (nextBadge) {
    nextBadge.isSheriff = true;
    nextBadge.destroyed = false;
  }
  const nextVoting = world.getComponent<VotingRightComponent>(
    nextSheriffId,
    COMPONENT.VotingRight,
  );
  if (nextVoting) {
    nextVoting.weight = 1.5;
  }

  events.push({
    timestamp: Date.now(),
    type: "sheriff_badge_transferred",
    payload: {
      fromId,
      toId: nextSheriffId,
      reason,
    },
  });

  return {
    fromId,
    toId: nextSheriffId,
    destroyed: false,
  };
}

function resetVotingWeight(world: World, entityId: EntityId): void {
  const voting = world.getComponent<VotingRightComponent>(
    entityId,
    COMPONENT.VotingRight,
  );
  if (!voting) {
    return;
  }
  voting.weight = voting.canVote ? 1 : 0;
}

/**
 * 按座位顺序选取下一位可接警徽的候选人。
 */
function pickNextSheriffCandidate(world: World, fromId: EntityId): EntityId | null {
  const aliveIds = world.getAliveEntityIds().filter((id) => id !== fromId);
  const seatMap = new Map<EntityId, number>();
  for (const id of aliveIds) {
    const identity = world.getComponent<IdentityComponent>(id, COMPONENT.Identity);
    seatMap.set(id, identity?.seat ?? id);
  }

  const candidates = aliveIds
    .filter((id) => {
      const alive = world.getComponent<AliveComponent>(id, COMPONENT.Alive);
      const voting = world.getComponent<VotingRightComponent>(id, COMPONENT.VotingRight);
      const badge = world.getComponent<BadgeComponent>(id, COMPONENT.Badge);
      return (
        alive?.alive === true &&
        voting?.canVote === true &&
        (badge?.destroyed ?? false) === false
      );
    })
    .sort((a, b) => (seatMap.get(a) ?? a) - (seatMap.get(b) ?? b));

  return candidates[0] ?? null;
}
