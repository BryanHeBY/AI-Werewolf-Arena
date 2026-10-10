import { openDemonBadgeFrame, assertDemonBadgeReadable } from "../roles/demon_hunter/authority";
import { weddingBadgeSwallowed } from "../roles/ghost_bride/authority";
/** 文件说明：警徽流转、销毁与授予逻辑。 */
import { AliveComponent } from "../../../core/domain/components/alive";
import { BadgeComponent } from "../../../core/domain/components/badge";
import { COMPONENT } from "../../../core/domain/components/names";
import { VotingRightComponent } from "../../../core/domain/components/voting_right";
import { IdentityComponent } from "../../../core/domain/entities/player";
import { BoardConfig, EntityId, GameEvent } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import { canBeSheriff } from "../common/participation";
import type { RoleCatalog } from "../roles/catalog";

const SHERIFF_VOTE_WEIGHT = 1.5;

export interface SheriffBadgeTransferResult {
  fromId: EntityId;
  toId: EntityId | null;
  destroyed: boolean;
}

export function assignSheriff(
  world: World,
  sheriffId: EntityId,
  config?: BoardConfig,
  catalog?: RoleCatalog,
): boolean {
  assertDemonBadgeReadable(world);
  if (weddingBadgeSwallowed(world) || !canBeSheriff(world, sheriffId, catalog)) return false;
  const frame = openDemonBadgeFrame(world);
  const weight = config?.sheriff?.voteWeight ?? SHERIFF_VOTE_WEIGHT;
  for (const id of world.getAliveEntityIds()) {
    const badge = world.getComponent<BadgeComponent>(id, COMPONENT.Badge);
    if (badge) {
      badge.isSheriff = id === sheriffId;
      badge.destroyed = false;
      badge.voteWeight = weight;
      if (config?.sheriff?.badgePolicy === "awa_holder_choice_v1")
        badge.handoffPolicy = "awa_holder_choice_v1";
      else delete badge.handoffPolicy;
    }
    const voting = world.getComponent<VotingRightComponent>(id, COMPONENT.VotingRight);
    if (voting?.canVote) voting.weight = id === sheriffId ? weight : 1;
  }
  frame?.commit({
    kind: "assign",
    sheriffId,
    weight,
    policy:
      config?.sheriff?.badgePolicy === "awa_holder_choice_v1" ? "awa_holder_choice_v1" : undefined,
  });
  return true;
}

export function transferOrDestroySheriffBadge(
  world: World,
  fromId: EntityId,
  reason: string,
  events: GameEvent[],
  catalog?: RoleCatalog,
): SheriffBadgeTransferResult | null {
  assertDemonBadgeReadable(world);
  const badge = world.getComponent<BadgeComponent>(fromId, COMPONENT.Badge);
  if (!badge?.isSheriff || badge.destroyed) return null;
  return commitSheriffBadgeChoice(
    world,
    fromId,
    reason,
    events,
    badge.handoffPolicy === "awa_holder_choice_v1"
      ? null
      : pickNextSheriffCandidate(world, fromId, catalog),
    catalog,
  );
}

/** Commits only a currently eligible target; a rejected choice destroys the held badge. */
export function commitSheriffBadgeChoice(
  world: World,
  fromId: EntityId,
  reason: string,
  events: GameEvent[],
  targetId: EntityId | null,
  catalog?: RoleCatalog,
): SheriffBadgeTransferResult | null {
  assertDemonBadgeReadable(world);
  const badge = world.getComponent<BadgeComponent>(fromId, COMPONENT.Badge);
  if (!badge?.isSheriff || badge.destroyed) return null;
  const frame = openDemonBadgeFrame(world);
  const weight = badge.voteWeight ?? SHERIFF_VOTE_WEIGHT;
  const policy = badge.handoffPolicy;
  const nextSheriffId =
    targetId !== null && badgeSuccessorEligible(world, fromId, targetId, catalog) ? targetId : null;
  badge.isSheriff = false;
  badge.destroyed = true;
  resetVotingWeight(world, fromId);
  if (nextSheriffId === null) {
    frame?.commit({ kind: "handoff", fromId, toId: null, weight, policy });
    events.push({
      timestamp: Date.now(),
      type: "sheriff_badge_destroyed",
      payload: { targetId: fromId, reason },
    });
    return { fromId, toId: null, destroyed: true };
  }
  const nextBadge = world.getComponent<BadgeComponent>(nextSheriffId, COMPONENT.Badge);
  if (nextBadge) {
    nextBadge.isSheriff = true;
    nextBadge.destroyed = false;
    nextBadge.voteWeight = weight;
    if (policy) nextBadge.handoffPolicy = policy;
    else delete nextBadge.handoffPolicy;
  }
  const nextVoting = world.getComponent<VotingRightComponent>(nextSheriffId, COMPONENT.VotingRight);
  if (nextVoting) nextVoting.weight = weight;
  frame?.commit({ kind: "handoff", fromId, toId: nextSheriffId, weight, policy });
  events.push({
    timestamp: Date.now(),
    type: "sheriff_badge_transferred",
    payload: { fromId, toId: nextSheriffId, reason },
  });
  return { fromId, toId: nextSheriffId, destroyed: false };
}

function resetVotingWeight(world: World, entityId: EntityId): void {
  const voting = world.getComponent<VotingRightComponent>(entityId, COMPONENT.VotingRight);
  if (voting) voting.weight = voting.canVote ? 1 : 0;
}

export function badgeSuccessorEligible(
  world: World,
  fromId: EntityId,
  id: EntityId,
  catalog?: RoleCatalog,
): boolean {
  assertDemonBadgeReadable(world);
  return (
    id !== fromId &&
    canBeSheriff(world, id, catalog) &&
    world.getComponent<AliveComponent>(id, COMPONENT.Alive)?.alive === true &&
    world.getComponent<VotingRightComponent>(id, COMPONENT.VotingRight)?.canVote === true &&
    world.getComponent<BadgeComponent>(id, COMPONENT.Badge)?.destroyed === false
  );
}

function pickNextSheriffCandidate(
  world: World,
  fromId: EntityId,
  catalog?: RoleCatalog,
): EntityId | null {
  assertDemonBadgeReadable(world);
  const candidates = world
    .getAliveEntityIds()
    .filter((id) => badgeSuccessorEligible(world, fromId, id, catalog));
  candidates.sort((a, b) => {
    const aSeat = world.getComponent<IdentityComponent>(a, COMPONENT.Identity)?.seat ?? a;
    const bSeat = world.getComponent<IdentityComponent>(b, COMPONENT.Identity)?.seat ?? b;
    return aSeat - bSeat;
  });
  return candidates[0] ?? null;
}

export function findSheriffId(world: World, catalog?: RoleCatalog): EntityId | null {
  assertDemonBadgeReadable(world);
  return (
    world.getAliveEntityIds().find((id) => {
      const badge = world.getComponent<BadgeComponent>(id, COMPONENT.Badge);
      return (
        badge?.isSheriff === true && badge.destroyed === false && canBeSheriff(world, id, catalog)
      );
    }) ?? null
  );
}

export function assignInitialSheriff(
  world: World,
  config: BoardConfig,
  playerIds: EntityId[],
): void {
  if (!config.enableSheriff || config.initialSheriffSeat === undefined) return;
  const sheriffId = playerIds.find(
    (id) =>
      world.getComponent<IdentityComponent>(id, COMPONENT.Identity)?.seat ===
      config.initialSheriffSeat,
  );
  if (sheriffId !== undefined) assignSheriff(world, sheriffId, config);
}
