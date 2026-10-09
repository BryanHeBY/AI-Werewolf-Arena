import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import { DeathCause, permitsHunterShot } from "../../../core/domain/model";
import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import type { DeathHook } from "../hooks/hook_registry";
import { activeDeathGun, allDeathGuns, captureDeathGun } from "./death_abilities";

/** One transferred/gifted stock per actor, after their native role hook has actually committed. */
export const giftGunDeathHook: DeathHook = async (world, ids, sources, choose, events, context) => {
  const result = {
    extraDeaths: [] as number[],
    extraDeathSources: {} as Record<number, DeathCause[]>,
    pendingShots: [] as NonNullable<
      import("../hooks/hook_registry").DeathHookResult["pendingShots"]
    >,
    nightEffectTargets: [] as number[],
  };
  for (const actorId of ids) {
    const current = () => context?.isCurrent?.() ?? true;
    if (!current()) break;
    const gun = allDeathGuns(world.getComponent<RoleComponent>(actorId, COMPONENT.Role))[0];
    if (!gun || !permitsHunterShot(sources[actorId] ?? [])) continue;
    const resolutionDay = context?.day;
    if (
      resolutionDay === null ||
      resolutionDay === undefined ||
      activeDeathGun(world, actorId, gun.id, resolutionDay, true) !== gun
    )
      continue;
    const scope = captureDeathGun(world, actorId, gun, resolutionDay, current),
      targets = new Map(world.getAliveEntityIds().map((id) => [id, captureNightLife(world, id)!]));
    const selected = await choose(actorId, gun.id);
    if (
      !scope.isEligible() ||
      selected.kind === "invalid" ||
      !world.isDeathActionOpen(actorId, "shoot", selected.deathActionId, gun.id)
    )
      continue;
    if (selected.kind === "pass") {
      gun.remaining = 0;
      continue;
    }
    const target = selected.targetScope ?? targets.get(selected.targetId);
    if (!target || target.id !== selected.targetId || !livingNightLife(world, target)) continue;
    gun.remaining = 0;
    if (context?.nightEffect && context.blocksNightShot(target.id)) {
      events.push({
        timestamp: Date.now(),
        type: "death_shot_blocked",
        payload: { actorId, targetId: target.id, reason: "night_protection" },
      });
      continue;
    }
    const event = {
      timestamp: Date.now(),
      type: "player_shot" as const,
      payload: { actorId, targetId: target.id },
    };
    result.extraDeaths.push(target.id);
    result.extraDeathSources[target.id] = [DeathCause.Shot];
    if (context?.nightEffect) result.nightEffectTargets.push(target.id);
    if (context?.deferShotCommit)
      result.pendingShots.push({ targetScope: target, event, isCurrent: scope.isCurrent });
    else events.push(event);
  }
  return result;
};
