/**
 * 定义一夜梦关系效果的运行接口；输入为实际窄生命查询、原死亡集合和既有伤害／事件容器。
 * 输出包含保护查询、追加死亡和同一效果实例的记录操作。它是含原生命与当前性回调的运行句柄，
 * 不是 JSON、玩家知识或权限品牌；实际关系、已付效果、reason 和 emitted 仍由具体梦效果 owner 持有。
 * 方法各有不同写范围：查询不提交资源，死亡推导会累计原因，扩展及记录会修改传入的结果或事件。
 * 接口隐藏内部关系／原因与去重状态，不增加清理、退款、行动授权或阶段推进。
 */
import type { EntityId, GameEvent } from "./model";
import type { World } from "./world";
import type { AliveComponent } from "./components/alive";
import { COMPONENT } from "./components/names";
import type { DamageResolutionResult } from "./systems/damage-resolution-system";

/** 运行查询只返回原体比较结果，不主动返回可写组件；外部自持原体不因此取得World。 */
export interface DreamLifeQueries {
  matchesAlive(id: EntityId, original: () => Readonly<AliveComponent>): boolean;
}
/** 可信调用方在原World参数位置绑定；绑定时不读组件、不缓存生命或World状态。 */
export function bindDreamLifeQueries(world: World): DreamLifeQueries {
  return {
    get matchesAlive() {
      // 原getComponent callee先于席位getter读取，原组件查询完成后才读比较右侧原体。
      // 新Reflect/bind准备在参数之前完成；调用保原World receiver，不从端口返回组件。
      const getComponent = world.getComponent;
      const invoke = Reflect.apply.bind(Reflect);
      return (id: EntityId, original: () => Readonly<AliveComponent>) =>
        invoke(getComponent, world, [id, COMPONENT.Alive]) === original();
    },
  };
}

export interface DreamNightEffects {
  /** 查询原行动者／目标的当前性；可能调用原有效性回调，不是无副作用纯函数。 */
  protectedTargets(queries: DreamLifeQueries): EntityId[];
  immuneNightTargets(queries: DreamLifeQueries): EntityId[];
  blocksNightShot(queries: DreamLifeQueries, targetId: EntityId): boolean;
  blocksNightCharm(
    queries: DreamLifeQueries,
    targetId: EntityId,
    eligibleDead: ReadonlySet<EntityId>,
  ): boolean;
  /** 返回连续摄梦或关系闭包造成的目标，并在同一实例内累计原因；不修改 Alive。 */
  consecutiveDeaths(queries: DreamLifeQueries): EntityId[];
  linkedDeaths(
    queries: DreamLifeQueries,
    nightDeaths: readonly EntityId[],
    eligibleDead?: ReadonlySet<EntityId>,
  ): EntityId[];
  /** 在原展开时点写入调用方的死亡名单／死因，不再次消费伤害印记或支付资源。 */
  expandInitialDamage(queries: DreamLifeQueries, damage: DamageResolutionResult): void;
  /** 同一实例拥有原因和已记录集合；先登记去重，再向原 events 发布，失败保留该前缀。 */
  recordDeaths(deadIds: readonly EntityId[], events: GameEvent[]): void;
}
