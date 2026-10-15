/**
 * 负责投票后两种板子的死亡提案与守墓人放逐反馈准备，保留各自原名单、来源和读取时点。
 * 输入为原投票结果、晚读 World 的查询及已构造的来源表；输出是新提案容器或原查验政策的反馈。
 * 动物板先合并放逐／河豚来源，实际死亡、关单位和公开事实之后才捕获主放逐反馈；
 * 普通板按原有效目标在死亡波之前捕获反馈，再准备放逐来源。本模块不统一这两种提交政策。
 * 这里只准备数据，不标死、打开单位、付款、发布事实、推进阶段或判胜；异常保留调用方已提交前缀。
 */
import {
  DeathCause,
  type DeathSources,
  type EntityId,
  type ExileFeedback,
  type VotingSummary,
} from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../domain/components/names";
import type { World } from "../domain/world";
import { captureExileFeedback } from "../features/gravekeeper/ports";

/** 只读原结果字段，不复制票表或冻结数组；提案容器不是死亡提交凭据或行动授权。 */
export interface ExileDeathSelection {
  readonly summary: Pick<VotingSummary, "target">;
  readonly removed: readonly EntityId[];
  readonly animalRetaliation?: readonly EntityId[];
}

/** 动物板的同一席位可同时有放逐和河豚来源；保留首次出现顺序，不把两来源折成单一死因。 */
export function prepareAnimalExileDeaths(selection: ExileDeathSelection) {
  const sources: DeathSources = {};
  for (const id of selection.removed) sources[id] = [DeathCause.Exile];
  for (const id of selection.animalRetaliation ?? [])
    sources[id] = [...new Set([...(sources[id] ?? []), DeathCause.PufferRetaliation])];
  const ids = [...new Set([...selection.removed, ...(selection.animalRetaliation ?? [])])];
  return { sources, ids };
}

/** 调用方已经完成动物死亡波与原公告；仅读实际死亡的主放逐目标，不把河豚牵连当反馈。 */
export function captureAnimalExileFeedback(
  world: () => World,
  selection: Pick<ExileDeathSelection, "summary">,
  sources: DeathSources,
  exileDay: number,
): ExileFeedback | null {
  const target = selection.summary.target;
  return target !== null &&
    sources[target]?.includes(DeathCause.Exile) &&
    world().getComponent(target, COMPONENT.Alive)?.alive === false
    ? captureExileFeedback(world(), target, exileDay)
    : null;
}

/** 普通板在死亡波前捕获已接受放逐的披露标签；有效目标由经理在原点选定，不再要求已标死。 */
export function captureOrdinaryExileFeedback(
  world: () => World,
  selection: Pick<ExileDeathSelection, "removed">,
  target: EntityId | null,
  exileDay: number,
): ExileFeedback | null {
  return target !== null && selection.removed.includes(target)
    ? captureExileFeedback(world(), target, exileDay)
    : null;
}

/** 普通反馈完成之后才构造来源；保持原遍历和重复目标覆盖，不补入摘要中没有移除的目标。 */
export function prepareOrdinaryExileDeaths(
  selection: Pick<ExileDeathSelection, "removed">,
): DeathSources {
  const sources: DeathSources = {};
  for (const removedId of selection.removed) {
    sources[removedId] = [DeathCause.Exile];
  }
  return sources;
}
