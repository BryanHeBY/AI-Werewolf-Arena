/** 文件说明：猎人死亡时开枪带人相关钩子。 */
import { AliveComponent } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import {
  EntityId,
  GameEvent,
  Role,
  DeathCause,
  permitsHunterShot,
  type DeathSources,
  type DeathShotSelection,
} from "../../../../core/domain/model";
import { World } from "../../../../core/domain/world";
import { DeathHookResult } from "../../hooks/hook_registry";
import { getHunterState } from "../private_state";

/** 猎人死亡钩子实现。 */
export async function hunterDeathHook(
  world: World,
  deadIds: EntityId[],
  deathSources: DeathSources,
  onHunterShoot: (hunterId: EntityId) => Promise<DeathShotSelection>,
  events: GameEvent[],
): Promise<DeathHookResult> {
  const extraDeaths: EntityId[] = [];
  const extraDeathSources: DeathSources = {};

  for (const deadId of deadIds) {
    const roleComp = world.getComponent<RoleComponent>(deadId, COMPONENT.Role);
    const hunterState = roleComp ? getHunterState(roleComp) : undefined;
    if (!roleComp || roleComp.role !== Role.Hunter || !hunterState || world.getComponent<AliveComponent>(deadId, COMPONENT.Alive)?.alive !== false) {
      continue;
    }

    const sources = deathSources[deadId] ?? [];
    if (sources.includes(DeathCause.Poison)) {
      hunterState.canShoot = false;
      events.push({
        timestamp: Date.now(),
        type: "hunter_silent_due_to_poison",
        payload: { hunterId: deadId },
      });
      continue;
    }

    if (!hunterState.canShoot || !permitsHunterShot(sources)) {
      hunterState.canShoot = false;
      continue;
    }

    const selection = await onHunterShoot(deadId);
    const currentRole = world.getComponent<RoleComponent>(deadId, COMPONENT.Role);
    if (currentRole !== roleComp || currentRole.role !== Role.Hunter || getHunterState(currentRole) !== hunterState || !hunterState.canShoot || world.getComponent<AliveComponent>(deadId, COMPONENT.Alive)?.alive !== false) continue;
    if (selection.kind === "invalid") continue;
    if (!world.isDeathActionOpen(deadId, "shoot", selection.deathActionId)) continue;
    if (selection.kind === "pass") {
      hunterState.canShoot = false;
      continue;
    }

    const targetId = selection.targetId;

    const targetAlive = world.getComponent<AliveComponent>(targetId, COMPONENT.Alive);
    if (!targetAlive || !targetAlive.alive) {
      continue;
    }

    hunterState.canShoot = false;
    extraDeaths.push(targetId);
    extraDeathSources[targetId] = [DeathCause.Shot];
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
