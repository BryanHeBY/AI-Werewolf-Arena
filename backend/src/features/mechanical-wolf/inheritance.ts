/**
 * 负责机械狼当前刀继承资格与原继承事实；输入为实际存活名单、原槽和晚阵营 source。
 * 状态先按原点查询，再核角色／阵营／模式；无 World 时仍保守拒刀，不建立 Role 反向索引。
 * 输出为刀权资格或原继承事实；刷新不改复制技能或真实阵营，先写继承再发表，后续错误保留已写前缀。
 */
import type { CurrentCampSource } from "../../domain/components/camp";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { Camp, Role, type EntityId, type GameEvent } from "../../domain/model";
import type { World } from "../../domain/world";
import { hasCurrentMechanicalKillMode } from "./night-scope";
import { getMechanicalState, mechanicalKnifeSelected, recordMechanicalInheritance } from "./state";

export interface MechanicalInheritanceFact {
  readonly actorId: EntityId;
  readonly day: number;
  readonly firstKnifeNight: number;
}

/** 只读资格保持保守分支，不创建继承，也不恢复已失效的本夜模式。 */
export function canMechanicalKnife(
  role: RoleComponent,
  world: World | undefined,
  currentCamp: CurrentCampSource,
): boolean {
  const state = getMechanicalState(role);
  if (
    !world ||
    role.role !== Role.MechanicalWolf ||
    currentCamp()?.camp !== Camp.Wolf ||
    !state ||
    !mechanicalKnifeSelected(state, state.mode?.day ?? 0) ||
    !hasCurrentMechanicalKillMode(world, role)
  )
    return false;
  const wolves = world.getAliveEntityIds().filter((id) => {
    const role = world.getComponent(id, COMPONENT.Role);
    return !!role && world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf;
  });
  return wolves.length === 1 && world.getComponent(wolves[0]!, COMPONENT.Role) === role;
}

/** 仅装配或死亡 owner 提交完整实际死亡后调用；事实副本不授当前刀权。 */
export function refreshMechanicalInheritance(
  world: World,
  day: number,
  events?: GameEvent[],
): MechanicalInheritanceFact[] {
  const wolves = world.getAliveEntityIds().filter((id) => {
    const role = world.getComponent(id, COMPONENT.Role);
    return !!role && world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf;
  });
  if (wolves.length !== 1) return [];
  const actorId = wolves[0]!,
    role = world.getComponent(actorId, COMPONENT.Role)!;
  if (role.role !== Role.MechanicalWolf) return [];
  const state = getMechanicalState(role);
  if (!state || !recordMechanicalInheritance(state, day)) return [];
  const fact = { actorId, day, firstKnifeNight: state.firstKnifeNight! };
  events?.push({ timestamp: Date.now(), type: "mechanical_awakened", payload: fact });
  return [fact];
}
