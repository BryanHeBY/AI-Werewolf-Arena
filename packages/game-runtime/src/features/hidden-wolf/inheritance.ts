/**
 * 负责隐狼原刀继承查询和刷新，输入为原槽、真实 World 与晚阵营 source。
 * 输出为原刀权资格与继承事实；原角色检查后才查阵营，再核继承状态与存活真狼，无 World 不授刀。
 * 持久继承来自实际提交，不改真实阵营，也不从拟议死亡授予权限。
 */
import type { CurrentCampSource } from "../../domain/components/camp";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { Camp, Role, type GameEvent } from "../../domain/model";
import type { World } from "../../domain/world";
import { getHiddenWolfState, recordHiddenWolfKnifeInheritance } from "./state";

/** 当前刀权与已获得的历史继承分别查询；数据标记本身不能恢复权限。 */
export function canHiddenWolfKnife(
  role: RoleComponent,
  world: World | undefined,
  currentCamp: CurrentCampSource,
): boolean {
  if (
    !world ||
    role.role !== Role.HiddenWolf ||
    currentCamp()?.camp !== Camp.Wolf ||
    getHiddenWolfState(role)?.hasInheritedKnife !== true
  )
    return false;
  const wolves = world.getAliveEntityIds().filter((id) => {
    const role = world.getComponent(id, COMPONENT.Role);
    return !!role && world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf;
  });
  return wolves.length === 1 && world.getComponent(wolves[0]!, COMPONENT.Role) === role;
}

/** 仅开局装配或实际死亡 owner 提交此变化；先写标记，发表失败不回退。 */
export function refreshHiddenWolfInheritance(world: World, events: GameEvent[], day: number): void {
  const wolves = world.getAliveEntityIds().filter((id) => {
    const role = world.getComponent(id, COMPONENT.Role);
    return !!role && world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf;
  });
  if (wolves.length !== 1) return;
  const actorId = wolves[0]!,
    role = world.getComponent(actorId, COMPONENT.Role)!;
  const state = role.role === Role.HiddenWolf ? getHiddenWolfState(role) : undefined;
  if (!state || state.hasInheritedKnife) return;
  recordHiddenWolfKnifeInheritance(state);
  events.push({ timestamp: Date.now(), type: "hidden_wolf_awakened", payload: { actorId, day } });
}
