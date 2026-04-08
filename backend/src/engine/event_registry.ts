import { AliveComponent } from "../domain/components/alive";
import { BadgeComponent } from "../domain/components/badge";
import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import { VotingRightComponent } from "../domain/components/voting_right";
import { EntityId, GameEvent, Role, StatusMark } from "../domain/model";
import { World } from "../domain/world";

export interface VotedOutResult {
  prevented: boolean;
  removed: EntityId[];
  reason: string;
}

export interface DeathHookResult {
  extraDeaths: EntityId[];
  extraDeathSources: Record<number, StatusMark[]>;
}

export class EventRegistry {
  onVotedOut(world: World, targetId: EntityId, events: GameEvent[]): VotedOutResult {
    const roleComp = world.getComponent<RoleComponent>(targetId, COMPONENT.Role);
    const aliveComp = world.getComponent<AliveComponent>(targetId, COMPONENT.Alive);

    if (!roleComp || !aliveComp || !aliveComp.alive) {
      return { prevented: false, removed: [], reason: "invalid_target" };
    }

    if (roleComp.role === Role.Idiot) {
      roleComp.idiotState = {
        revealed: true,
      };

      const voting = world.getComponent<VotingRightComponent>(
        targetId,
        COMPONENT.VotingRight,
      );
      if (voting) {
        voting.canVote = false;
        voting.weight = 0;
      }

      const badge = world.getComponent<BadgeComponent>(targetId, COMPONENT.Badge);
      if (badge?.isSheriff) {
        badge.isSheriff = false;
        badge.destroyed = true;
      }

      events.push({
        timestamp: Date.now(),
        type: "idiot_revealed",
        payload: {
          targetId,
        },
      });

      return {
        prevented: true,
        removed: [],
        reason: "idiot_revealed",
      };
    }

    const badge = world.getComponent<BadgeComponent>(targetId, COMPONENT.Badge);
    if (badge?.isSheriff) {
      badge.isSheriff = false;
      badge.destroyed = true;
      events.push({
        timestamp: Date.now(),
        type: "sheriff_badge_destroyed",
        payload: {
          targetId,
          reason: "voted_out",
        },
      });
    }

    aliveComp.alive = false;
    return {
      prevented: false,
      removed: [targetId],
      reason: "normal_voted_out",
    };
  }

  async onDeath(
    world: World,
    deadIds: EntityId[],
    deathSources: Record<number, StatusMark[]>,
    onHunterShoot: (hunterId: EntityId) => Promise<EntityId | null>,
    events: GameEvent[],
  ): Promise<DeathHookResult> {
    const extraDeaths: EntityId[] = [];
    const extraDeathSources: Record<number, StatusMark[]> = {};

    for (const deadId of deadIds) {
      const roleComp = world.getComponent<RoleComponent>(deadId, COMPONENT.Role);
      if (!roleComp || roleComp.role !== Role.Hunter || !roleComp.hunterState) {
        continue;
      }

      const sources = deathSources[deadId] ?? [];
      if (sources.includes(StatusMark.PoisonMark)) {
        roleComp.hunterState.canShoot = false;
        events.push({
          timestamp: Date.now(),
          type: "hunter_silent_due_to_poison",
          payload: { hunterId: deadId },
        });
        continue;
      }

      if (!roleComp.hunterState.canShoot || this.isLastGod(world, deadId)) {
        roleComp.hunterState.canShoot = false;
        continue;
      }

      const targetId = await onHunterShoot(deadId);
      roleComp.hunterState.canShoot = false;
      if (targetId === null) {
        continue;
      }

      const targetAlive = world.getComponent<AliveComponent>(targetId, COMPONENT.Alive);
      if (!targetAlive || !targetAlive.alive) {
        continue;
      }

      targetAlive.alive = false;
      extraDeaths.push(targetId);
      extraDeathSources[targetId] = [StatusMark.WolfKillMark];
      events.push({
        timestamp: Date.now(),
        type: "hunter_shot",
        payload: {
          hunterId: deadId,
          targetId,
        },
      });
    }

    return { extraDeaths, extraDeathSources };
  }

  private isLastGod(world: World, hunterId: EntityId): boolean {
    const alive = world.getAliveEntityIds();
    for (const id of alive) {
      if (id === hunterId) {
        continue;
      }
      const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (
        role &&
        [Role.Seer, Role.Guard, Role.Witch, Role.Hunter, Role.Idiot].includes(
          role.role,
        )
      ) {
        return false;
      }
    }
    return true;
  }
}
