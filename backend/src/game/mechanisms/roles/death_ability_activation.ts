/**
 * Activates late death abilities for the actual recipient instances. Inputs are the current
 * night context and owned gun/ability records; outputs preserve activation commit bookkeeping.
 * It never installs a new role or allows a retired source to reclaim a death action.
 */
import type { World } from "../../../core/domain/world";
import type { RoleComponent } from "../../../core/domain/components/role";
import { COMPONENT } from "../../../core/domain/components/names";
import type { NightStageHandler } from "../stages/night/contracts";
import { allDeathGuns, armDeathGun } from "./death_abilities";
const committed = new WeakMap<World, Set<number>>();
export function hasDeathAbilityActivationCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}
export const DEATH_ABILITY_ACTIVATION_STAGE: NightStageHandler = {
  id: "death_ability_activation",
  priority: 900,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const actorId of ctx.world.getAliveEntityIds())
      for (const gun of allDeathGuns(ctx.world.getComponent(actorId, COMPONENT.Role))) {
        if (!ctx.isCurrent() || ctx.currentDay() !== day) return;
        if (gun.armedOnNight !== null) continue;
        armDeathGun(ctx.world, actorId, gun, day, ctx.events);
        if (gun.armedOnNight === day) {
          const days = committed.get(ctx.world) ?? new Set<number>();
          days.add(day);
          committed.set(ctx.world, days);
        }
      }
  },
};
