import { AliveComponent } from "../../../domain/components/alive";
import { BadgeComponent } from "../../../domain/components/badge";
import { COMPONENT } from "../../../domain/components/names";
import { RoleComponent } from "../../../domain/components/role";
import { VotingRightComponent } from "../../../domain/components/voting_right";
import { EntityId, GameEvent, Role } from "../../../domain/model";
import { World } from "../../../domain/world";
import { VotedOutResult } from "../../hooks/hook_registry";
import { transferOrDestroySheriffBadge } from "../../sheriff/sheriff_badge";

export function idiotVotedOutHook(
  world: World,
  targetId: EntityId,
  events: GameEvent[],
): VotedOutResult | null {
  const roleComp = world.getComponent<RoleComponent>(targetId, COMPONENT.Role);
  const aliveComp = world.getComponent<AliveComponent>(targetId, COMPONENT.Alive);
  if (!roleComp || !aliveComp || !aliveComp.alive) {
    return null;
  }
  if (roleComp.role !== Role.Idiot) {
    return null;
  }

  roleComp.idiotState = {
    revealed: true,
  };

  const voting = world.getComponent<VotingRightComponent>(targetId, COMPONENT.VotingRight);
  if (voting) {
    voting.canVote = false;
    voting.weight = 0;
  }

  const badge = world.getComponent<BadgeComponent>(targetId, COMPONENT.Badge);
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
