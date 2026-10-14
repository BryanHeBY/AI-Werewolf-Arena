/**
 * 负责夜能力变更共用的原角色查询与事实发布。输入为原 World／actor 或原实例／事件数组；
 * 输出为实际 Role 引用或追加的 ability_changed 事实。授予／转移和启停／死亡到期两个负责人共用此实现。
 * 角色缺失仍先报原错误；发布按原 push 方法、Date.now、字段和 source 克隆顺序执行，错误不撤回先前库存写入。
 * 不校验新 payload、寻找替代实例、授予行动权限或建立额外资源账本；本内部叶不经机制聚合出口公开。
 */
import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { EntityId, GameEvent } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import type { NightAbilityReadView } from "./abilities";

export const roleOf = (world: World, actorId: EntityId): RoleComponent => {
  const role = world.getComponent(actorId, COMPONENT.Role);
  if (!role) throw new Error("ability_actor_missing");
  return role;
};

export const emit = (
  events: GameEvent[],
  actorId: EntityId,
  ability: NightAbilityReadView,
  operation: "granted" | "disabled" | "enabled" | "transferred_out",
) =>
  events.push({
    timestamp: Date.now(),
    type: "ability_changed",
    payload: {
      actorId,
      abilityId: ability.id,
      kind: ability.kind,
      operation,
      source: structuredClone(ability.source),
      sourceDisclosed: ability.sourceDisclosed,
      startsOnDay: ability.startsOnDay,
      ...(ability.expiresAfterDay === undefined
        ? {}
        : { expiresAfterDay: ability.expiresAfterDay }),
      maxUses: ability.maxUses,
    },
  });
