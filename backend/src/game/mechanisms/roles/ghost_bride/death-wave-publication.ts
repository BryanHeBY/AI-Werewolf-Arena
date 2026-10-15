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
import type { World } from "../../../../domain/world";
import { expandWeddingDeaths, weddingGroup } from "./authority";

/**
 * 只声明四项原位查询，装配 getter 不缓存状态或时钟。world 仍是原运行对象，
 * 这不是可序列化 DTO、进程隔离或运行权限屏障；关系授权仍由原 authority 检查。
 */
interface WeddingDeathWaveRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  readonly day: number;
  readonly phase: Phase;
}

export class WeddingDeathWavePublication {
  constructor(private readonly runtime: WeddingDeathWaveRuntime) {}

  /** 先完成原地关系扩张，再逐边发布；最后仅筛出不在初始名单中的席位，不回滚失败前缀。 */
  expand(
    ids: number[],
    sources: DeathSources,
    seen: ReadonlySet<number>,
    nightOrigin: Set<number>,
  ): number[] {
    const before = new Set(ids);
    for (const edge of expandWeddingDeaths(this.runtime.world, ids, sources, seen, nightOrigin)) {
      // 逐边调用原婚约查询；不提前读取 groupId 或缓存上一条边的快照。
      const group = weddingGroup(this.runtime.world)!;
      this.runtime.events.push({
        timestamp: Date.now(),
        type: "ghost_bride_partner_death",
        payload: {
          policy: GHOST_BRIDE_POLICY,
          groupId: group.groupId,
          day: this.runtime.day,
          phase: this.runtime.phase,
          ...edge,
        },
        audience: Object.freeze([]),
      });
    }
    return ids.filter((id) => !before.has(id));
  }
}
