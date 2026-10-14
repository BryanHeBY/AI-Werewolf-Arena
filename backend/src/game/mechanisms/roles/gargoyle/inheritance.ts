/**
 * 负责石像鬼原刀权继承查询与继承状态／事实刷新；输入为原角色、World、事件和明确日次。
 * 查询依原顺序核角色、继承标记、本夜查验完成回执，再核当前存活真狼名单；输出只是原刀权资格。
 * 刷新先写继承标记，后发表觉醒事实，发表失败不退标记；本模块不改角色或从未提交死亡推断继承。
 * 查验完成通过轻公开记账端口晚读，不能以公开函数或合法状态形状重新授权旧请求。
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role, type GameEvent } from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import { getGargoyleState, recordGargoyleKnifeInheritance } from "./state";
import { completedGargoyleInspection } from "../role_inspection/night-commit-ports";

export function canGargoyleKnife(role: RoleComponent, world?: World): boolean {
  if (
    !world ||
    role.role !== Role.Gargoyle ||
    role.camp !== Camp.Wolf ||
    getGargoyleState(role)?.hasInheritedKnife !== true ||
    !completedGargoyleInspection(world, role)
  )
    return false;
  const wolves = world
    .getAliveEntityIds()
    .filter((id) => world.getComponent(id, COMPONENT.Role)?.camp === Camp.Wolf);
  return wolves.length === 1 && world.getComponent(wolves[0]!, COMPONENT.Role) === role;
}
export function refreshGargoyleInheritance(world: World, events: GameEvent[], day: number): void {
  const wolves = world
    .getAliveEntityIds()
    .filter((id) => world.getComponent(id, COMPONENT.Role)?.camp === Camp.Wolf);
  if (wolves.length !== 1) return;
  const actorId = wolves[0]!,
    role = world.getComponent(actorId, COMPONENT.Role)!,
    state = role.role === Role.Gargoyle ? getGargoyleState(role) : undefined;
  if (!state || state.hasInheritedKnife) return;
  recordGargoyleKnifeInheritance(state);
  events.push({ timestamp: Date.now(), type: "gargoyle_awakened", payload: { actorId, day } });
}
