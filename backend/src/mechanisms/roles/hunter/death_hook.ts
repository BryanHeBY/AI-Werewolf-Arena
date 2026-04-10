import { AliveComponent } from "../../../domain/components/alive";
import { COMPONENT } from "../../../domain/components/names";
import { RoleComponent } from "../../../domain/components/role";
import {
  EntityId,
  GameEvent,
  Role,
  StatusMark,
} from "../../../domain/model";
import { World } from "../../../domain/world";
import { DeathHookResult } from "../../hooks/hook_registry";
import { getHunterState } from "../private_state";

export async function hunterDeathHook(
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
    const hunterState = roleComp ? getHunterState(roleComp) : undefined;
    if (!roleComp || roleComp.role !== Role.Hunter || !hunterState) {
      continue;
    }

    const sources = deathSources[deadId] ?? [];
    if (sources.includes(StatusMark.PoisonMark)) {
      hunterState.canShoot = false;
      events.push({
        timestamp: Date.now(),
        type: "hunter_silent_due_to_poison",
        payload: { hunterId: deadId },
      });
      continue;
    }

    if (!hunterState.canShoot || isLastGod(world, deadId)) {
      hunterState.canShoot = false;
      continue;
    }

    const targetId = await onHunterShoot(deadId);
    hunterState.canShoot = false;
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

function isLastGod(world: World, hunterId: EntityId): boolean {
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
