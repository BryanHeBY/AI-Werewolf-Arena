/**
 * 负责按原顺序组合四个机制的公开普通狼刀目标查询。
 * 输入为当前目标序号、狼刀圈／角色政策及存活名单；输出为原候选允许布尔值。
 * 依次读取雾鸦狼刀圈、夜之贵族政策、存活名单、恶夜骑士及梦魇，短路与查询失败原样保留。
 * 绑定只捕获原 World 引用，不提前读组件、生命、库存或随机源；查询不公开 World 与提交写权。
 * 表面冻结不冻结 World 或复制名单，现场候选允许结果也不是实际狼刀提交许可。
 */
import type { EntityId } from "../../../../domain/identity";
import type { World } from "../../../../domain/world";
import { bindMistKnifeTargetQuery, type MistKnifeTargetQuery } from "../mist_raven/ports";
import { bindNobleKnifeTargetQuery, type NobleKnifeTargetQuery } from "../noble_secret_body/ports";
import {
  bindEvilKnightKnifeTargetQuery,
  type EvilKnightKnifeTargetQuery,
} from "../evil_knight/ports";
import {
  bindNightmareKnifeTargetQuery,
  type NightmareKnifeTargetQuery,
} from "../nightmare_shadow/ports";

/** 名单在 allows 内的原第三步才读取；返回原只读视图，不保存第二份阵容快照。 */
export interface WolfKnifeRosterQuery {
  aliveIds(): readonly EntityId[];
}
/** 仅提供目标谓词，不携带回合、能力实例或付款权限。 */
export interface WolfKnifeTargetQuery {
  allows(targetId: EntityId): boolean;
}

/** 固定组合顺序；保留每个查询的原 receiver 与短路，不新增可扩展规则图或角色回调注册器。 */
export function createWolfKnifeTargetQuery(
  roster: WolfKnifeRosterQuery,
  mist: MistKnifeTargetQuery,
  noble: NobleKnifeTargetQuery,
  evilKnight: EvilKnightKnifeTargetQuery,
  nightmare: NightmareKnifeTargetQuery,
): WolfKnifeTargetQuery {
  return Object.freeze({
    allows(targetId: EntityId) {
      const circle = mist.targets();
      return (
        (circle === null || circle.includes(targetId)) &&
        noble.allows(targetId) &&
        roster.aliveIds().includes(targetId) &&
        evilKnight.allows(targetId) &&
        nightmare.allows(targetId)
      );
    },
  });
}

/** 只捕获 World 参数引用，四个具体绑定仍按原顺序创建；所有现场查询延迟至 allows。 */
export function bindWolfKnifeTargetQuery(world: World): WolfKnifeTargetQuery {
  return createWolfKnifeTargetQuery(
    { aliveIds: () => world.getAliveEntityIds() },
    bindMistKnifeTargetQuery(world),
    bindNobleKnifeTargetQuery(world),
    bindEvilKnightKnifeTargetQuery(world),
    bindNightmareKnifeTargetQuery(world),
  );
}
