/**
 * 负责觉醒隐狼的原刀继承资格与持久事实，按实际存活阵营名单查询，不从死亡提案发刀。
 * 输入保 World／日期、原槽和晚阵营 source；在原角色检查后才查阵营，不反向查找 Role 所属 World。
 * 输出为刀权资格与原继承事实；槽与本夜权限仍由原 owner 复验，刷新后事实失败不回退已写前缀。
 */
import type { CurrentCampSource } from "../../domain/components/camp";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { Camp, Role, type GameEvent } from "../../domain/model";
import type { World } from "../../domain/world";
import { currentAwakenedNight } from "./night-scope";
import { awakenedKnifeReady, getAwakenedState, recordAwakenedInheritance } from "./state";

export function canAwakenedKnife(role: RoleComponent, world: World | undefined, currentCamp: CurrentCampSource): boolean {
  const state = getAwakenedState(role),
    night = world && currentAwakenedNight(world, role);
  if (
    !world ||
    role.role !== Role.AwakenedHiddenWolf ||
    currentCamp()?.camp !== Camp.Wolf ||
    !state ||
    night == null ||
    !awakenedKnifeReady(state, night)
  )
    return false;
  const wolves = world
    .getAliveEntityIds()
    .filter((id) => {
      const role = world.getComponent(id, COMPONENT.Role);
      return !!role && world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf;
    });
  return wolves.length === 1 && world.getComponent(wolves[0]!, COMPONENT.Role) === role;
}
/** 仅开局装配和实际死亡提交后刷新持久继承；不把查询或拟议死亡当作提交。 */
export function refreshAwakenedInheritance(world: World, day: number, events: GameEvent[]): void {
  const wolves = world
    .getAliveEntityIds()
    .filter((id) => {
      const role = world.getComponent(id, COMPONENT.Role);
      return !!role && world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf;
    });
  if (wolves.length !== 1) return;
  const actorId = wolves[0]!,
    role = world.getComponent(actorId, COMPONENT.Role)!,
    state = getAwakenedState(role);
  if (role.role !== Role.AwakenedHiddenWolf || !state || !recordAwakenedInheritance(state, day))
    return;
  events.push({
    timestamp: Date.now(),
    type: "awakened_inherited",
    payload: { actorId, day, firstKnifeNight: state.firstKnifeNight! },
  });
}
