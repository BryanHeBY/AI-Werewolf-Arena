/**
 * 提供梦魇绑定的恐惧资格、普通狼刀目标及原状态读取查询。
 * 输入是玩家／日期、候选序号或原角色；输出保留原恐惧谓词、狼行动政策及同一可读状态绑定。
 * 绑定只捕获原 World 引用，不提前读组件或返回 World、状态写者、夜间开启或效果提交方法。
 * 名单复验公开同一原函数，供夜间规则组合及阶段检查点读取，不改其原名单撤销；
 * 查询时仍传播原名单撤销与目标生命失败；板子谓词保持原只读绑定及调用方重复参数的读取顺序。
 */
import type { EntityId } from "../../../../core/domain/model";
import { Role } from "../../../../core/domain/identity";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { World } from "../../../../core/domain/world";
import { nightmareFearBlocks } from "./night_frame";
export { isNightmareBoard, nightmareKnifeBlocked, assertNightmareRosterCurrent } from "./night_frame";
import { getNightmareShadowState } from "./state";

export interface NightmareNightEligibility {
  blocks(actorId: EntityId, day: number): boolean;
}

export function bindNightmareNightEligibility(world: World): NightmareNightEligibility {
  return Object.freeze({
    blocks: (actorId: EntityId, day: number) => nightmareFearBlocks(world, actorId, day),
  });
}

export interface NightmareKnifeTargetQuery {
  allows(targetId: EntityId): boolean;
}

export function bindNightmareKnifeTargetQuery(world: World): NightmareKnifeTargetQuery {
  return Object.freeze({
    allows: (targetId: EntityId) =>
      world.getComponent(targetId, COMPONENT.Role)?.role !== Role.NightmareShadow ||
      getNightmareShadowState(world.getComponent(targetId, COMPONENT.Role))?.wolfActionPolicy ===
        "standard",
  });
}

export { getNightmareShadowState } from "./state";
