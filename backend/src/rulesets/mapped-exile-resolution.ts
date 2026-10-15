/**
 * 负责诡术师最终放逐映射、原事实发表、出局提案与公开字段的同步规则组合。
 * 输入为原目标、晚读 World／日期／事件与钩子 receiver、同一映射对象；输出为原有效目标、移除副本及摘要字段。
 * frame 唯一消费 exileResolved，映射对象仍作为事件 payload 同引用；发表失败不退回本次已付映射。
 * Noble 翻牌／必需发言仍由流水线在两业务块之间推进；missed 只抑制后续出局钩子，不跳过该窗口。
 * 票、PK、Animal 封票／河豚等待、放逐单位与阶段仍归原 owner；这里只准备提案和事实，不标死或授许可。
 * missed 与 effectiveId 在原点晚读，公开最终字段在摘要构造位置读取；异常保留已提交事件和钩子前缀。
 * 规则见 docs/rules/awa-trickster-exile-v1.md。
 */
import type {
  ReadonlyBoardConfig,
  EntityId,
  VotingSummary,
} from "@ai-werewolf-arena/game-contract";
import type { World } from "../domain/world";
import type { GameEvent } from "../domain/events";
import type { VotedOutResult } from "../engine/hooks/registry";
import { resolveTricksterExile } from "../features/trickster/ports";

/** 原可写运行输出，不设新品牌或冻结；事件 payload 与后续查询必须仍指向同一对象。 */
export type MappedExile = ReturnType<typeof resolveTricksterExile>;

/** 属性由真实调用方 getter 延迟提供；readonly 不冻结 World、事件或政策，也不代表权限。 */
export interface MappedExilePreparationRuntime {
  readonly enabled: ReadonlyBoardConfig["trickster"];
  readonly world: World;
  readonly day: number;
  readonly events: GameEvent[];
}

/** 映射完成后先发表原对象，再读取 effectiveId；不可提前缓存以绕过原 push 回调。 */
export function prepareMappedExile(
  runtime: MappedExilePreparationRuntime,
  target: EntityId,
): { mapped: MappedExile | null; effectiveTarget: EntityId } {
  const mapped = runtime.enabled ? resolveTricksterExile(runtime.world, runtime.day, target) : null;
  if (mapped)
    runtime.events.push({ timestamp: Date.now(), type: "exile_target_mapped", payload: mapped });
  const effectiveTarget = mapped?.effectiveId ?? target;
  return { mapped, effectiveTarget };
}

/** 只公开本步实际需要的原钩子方法；方法仍用原对象 receiver，结构接口不是运行权限屏障。 */
export interface MappedExileResolutionRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  readonly eventRegistry: {
    onVotedOut(world: World, targetId: EntityId, events: GameEvent[]): VotedOutResult;
  };
  readonly animalUnit: object | undefined;
}

/** 已完成原 Noble 交接后才执行；映射落空不退回原目标，Animal 仍抑制普通 voted_out 事实。 */
export function resolveMappedExile(
  runtime: MappedExileResolutionRuntime,
  mapped: MappedExile | null,
  effectiveTarget: EntityId,
): EntityId[] {
  const votedOut = mapped?.missed
    ? { removed: [] }
    : runtime.eventRegistry.onVotedOut(runtime.world, effectiveTarget, runtime.events);
  const removed = [...votedOut.removed];

  if (removed.includes(effectiveTarget) && !runtime.animalUnit) {
    // 只有原钩子返回真实移除提案才广播；白痴翻牌仍由原事件钩子单独发表。
    runtime.events.push({
      timestamp: Date.now(),
      type: "voted_out",
      payload: {
        target: effectiveTarget,
      },
    });
  }
  return removed;
}

/** 在原摘要展开位置再读 missed；上面的钩子／事件回调可修改同一映射，不缓存早期分类。 */
export function mappedExileSummary(
  mapped: MappedExile | null,
  effectiveTarget: EntityId,
): Pick<VotingSummary, "effectiveTarget"> {
  return mapped ? { effectiveTarget: mapped.missed ? null : effectiveTarget } : {};
}
