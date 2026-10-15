/**
 * 负责石像鬼原刀权继承查询与继承状态／事实刷新；输入为原角色、World、事件和明确日次。
 * 查询依原顺序核角色、继承标记、本夜查验完成回执，再核当前存活真狼名单；输出只是原刀权资格。
 * 刷新先写继承标记，后发表觉醒事实，发表失败不退标记；本模块不改角色或从未提交死亡推断继承。
 * 查验完成通过轻公开记账端口晚读，不能以公开函数或合法状态形状重新授权旧请求。
 */
import type { CurrentCampSource } from "../../../../domain/components/camp";
import { COMPONENT } from "../../../../domain/components/names";
import type { RoleComponent } from "../../../../domain/components/role";
import { Camp, Role, type GameEvent } from "../../../../domain/model";
import type { World } from "../../../../domain/world";
import { getGargoyleState, recordGargoyleKnifeInheritance } from "./state";
import { completedGargoyleInspection } from "../role_inspection/night-commit-ports";

export function canGargoyleKnife(role: RoleComponent, world: World | undefined, currentCamp: CurrentCampSource): boolean {
  if (
    !world ||
    role.role !== Role.Gargoyle ||
    currentCamp()?.camp !== Camp.Wolf ||
    getGargoyleState(role)?.hasInheritedKnife !== true ||
    !completedGargoyleInspection(world, role)
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
export function refreshGargoyleInheritance(world: World, events: GameEvent[], day: number): void {
  const wolves = world
    .getAliveEntityIds()
    .filter((id) => {
      const role = world.getComponent(id, COMPONENT.Role);
      return !!role && world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf;
    });
  if (wolves.length !== 1) return;
  const actorId = wolves[0]!,
    role = world.getComponent(actorId, COMPONENT.Role)!,
    state = role.role === Role.Gargoyle ? getGargoyleState(role) : undefined;
  if (!state || state.hasInheritedKnife) return;
  recordGargoyleKnifeInheritance(state);
  events.push({ timestamp: Date.now(), type: "gargoyle_awakened", payload: { actorId, day } });
}
