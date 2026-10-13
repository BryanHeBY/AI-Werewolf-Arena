/**
 * Implements Idiot reveal immunity when the original alive player is voted out. Inputs are the
 * target and current private state; outputs are the saved-player result and reveal event. The
 * hook writes revealed/voting rights before badge handling, but never resolves the remaining
 * death wave; repeated reveal does not restore retired voting rights.
 */
import { commitDemonIdiotReveal, demonIdiotRevealed } from "../demon_hunter/authority";
/** 文件说明：白痴被放逐时翻牌免死的钩子实现。 */
import { AliveComponent } from "../../../../core/domain/components/alive";
import { BadgeComponent } from "../../../../core/domain/components/badge";
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import { VotingRightComponent } from "../../../../core/domain/components/voting_right";
import { EntityId, GameEvent, Role } from "../../../../core/domain/model";
import { World } from "../../../../core/domain/world";
import { VotedOutResult } from "../../hooks/hook_registry";
import { transferOrDestroySheriffBadge } from "../../sheriff/badge";
import { getIdiotState, setIdiotState } from "./state";

/** 白痴放逐钩子实现。 */
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
  if (demonIdiotRevealed(world, targetId) ?? getIdiotState(roleComp)?.revealed) {
    return { prevented: true, removed: [], reason: "idiot_already_revealed" };
  }

  if (!commitDemonIdiotReveal(world, targetId)) {
    setIdiotState(roleComp, { revealed: true });
    const voting = world.getComponent(targetId, COMPONENT.VotingRight);
    if (voting) {
      voting.canVote = false;
      voting.weight = 0;
    }
  }

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
