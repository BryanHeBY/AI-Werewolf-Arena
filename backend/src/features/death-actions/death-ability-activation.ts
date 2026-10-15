/**
 * 负责在夜末对实际持枪实例尝试激活，并记录该 World／夜数的激活提交。输入为当前夜上下文、
 * 存活玩家和原枪记录；输出为原武装效果及提交查询。资格和资源写仍由 armDeathGun 持有；
 * 这里按原序在激活返回、armedOnNight 命中后记账，不安装新 Role 或自行恢复撤销的枪权。
 */
import type { World } from "../../domain/world";
import type { RoleComponent } from "../../domain/components/role";
import { COMPONENT } from "../../domain/components/names";
import type { NightStageHandler } from "../../engine/night/contracts";
import { allDeathGuns, armDeathGun } from "./death-abilities";
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
