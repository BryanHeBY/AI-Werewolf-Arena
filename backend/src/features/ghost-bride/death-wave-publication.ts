/**
 * 负责幽灵新娘死亡波的完整关系扩张与逐边私密事实发布。输入为原死亡名单、可写死因表、
 * 已纳入席位和夜间来源，以及惰性运行查询；输出为本次新增席位，保留名单／来源的原地修改。
 * 原关系权威独自拥有资格、原体及边去重；每条边重新读取婚约，事件 callee、时钟、日期和阶段
 * 在原表达式处求值。发布失败保留此前关系修改和已追加事实，不退款或重建去重状态。
 * 本模块不标死、授予枪／遗言权限、处理其他关系、切换阶段或判胜。
 * 规则依据：docs/rules/awa-melbourne-ghost-bride-v1.md。
 */
import type { DeathSources, GameEvent, Phase } from "@ai-werewolf-arena/game-contract";
import { GHOST_BRIDE_POLICY } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import type { World } from "../../domain/world";
import { expandWeddingDeaths, weddingGroup } from "./authority";

/**
 * 仅可信装配持有四项原位读取源；绑定时不查询状态或时钟。
 * 实际执行对象只保存下方三项本族port，原World不进入动态扩展上下文或返回句柄。
 */
interface WeddingDeathWaveRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  readonly day: number;
  readonly phase: Phase;
}
/** 执行体只拿本族扩张、逐边婚约查询与专用事实命令；没有World或通用写回门。 */
export interface WeddingDeathWavePorts {
  expandDeaths(
    ids: number[],
    sources: DeathSources,
    seen: ReadonlySet<number>,
    nightOrigin: Set<number>,
  ): ReturnType<typeof expandWeddingDeaths>;
  currentGroup(): ReturnType<typeof weddingGroup>;
  appendPartnerDeath(
    group: NonNullable<ReturnType<typeof weddingGroup>>,
    edge: ReturnType<typeof expandWeddingDeaths>[number],
  ): void;
}
/** 可信DR构造完整owner；只建立闭包，World/events/day/phase均在原表达式位置读取。 */
export function bindWeddingDeathWavePublication(
  runtime: WeddingDeathWaveRuntime,
): WeddingDeathWavePublication {
  return new WeddingDeathWavePublication({
    get expandDeaths(): WeddingDeathWavePorts["expandDeaths"] {
      const expand = expandWeddingDeaths;
      return (ids, sources, seen, nightOrigin) =>
        expand(runtime.world, ids, sources, seen, nightOrigin);
    },
    get currentGroup() {
      const current = weddingGroup;
      return () => current(runtime.world);
    },
    appendPartnerDeath(group, edge) {
      runtime.events.push({
        timestamp: Date.now(),
        type: "ghost_bride_partner_death",
        payload: {
          policy: GHOST_BRIDE_POLICY,
          groupId: group.groupId,
          day: runtime.day,
          phase: runtime.phase,
          ...edge,
        },
        audience: Object.freeze([]),
      });
    },
  });
}

export class WeddingDeathWavePublication {
  constructor(private readonly ports: WeddingDeathWavePorts) {}

  /** 先完成原地关系扩张，再逐边发布；最后仅筛出不在初始名单中的席位，不回滚失败前缀。 */
  expand(
    ids: number[],
    sources: DeathSources,
    seen: ReadonlySet<number>,
    nightOrigin: Set<number>,
  ): number[] {
    const before = new Set(ids);
    for (const edge of this.ports.expandDeaths(ids, sources, seen, nightOrigin)) {
      // 逐边调用原婚约查询；不提前读取 groupId 或缓存上一条边的快照。
      const group = this.ports.currentGroup()!;
      this.ports.appendPartnerDeath(group, edge);
    }
    return ids.filter((id) => !before.has(id));
  }
}
