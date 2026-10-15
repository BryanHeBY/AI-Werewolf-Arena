/**
 * 负责从玩家观察、具名随机流和风格建立受限策略上下文。输入为已投影候选、自己的能力与行动历史；
 * 输出为同一观察及局部选择／重复目标判断，不查询 World、真实 camp 或提交行动。
 * undefined 允许继续寻找处理器，null 表示明确不行动；原策略和随机读取顺序保持。
 */
import type { RandomDraws, ToolCall } from "../../../../domain";
import type { PlayerObservation } from "../../../../game/observation/player-observation";

export type BotStyle = "active" | "conservative" | "competitive" | "random";
export type ObservedBotContext = ReturnType<typeof createObservedBotContext>;
/** undefined 继续查找；null 是明确的终态不行动。 */
export type ObservedToolHandler = (context: ObservedBotContext) => ToolCall | null | undefined;
export interface ObservedToolEntry {
  readonly tool: ToolCall["name"];
  readonly decide: ObservedToolHandler;
}

export function createObservedBotContext(
  observation: PlayerObservation,
  random: RandomDraws,
  style: BotStyle,
) {
  const { request, knownAliveIds, ownState, teammateIds } = observation;
  const actor = request.actorId;
  const others = knownAliveIds.filter((id) => id !== actor);
  const pick = (ids: number[]) =>
    ids.length ? ids[Math.floor(random.next() * ids.length)] : undefined;
  const bound = observation.abilities.find((ability) => ability.id === request.context.ability_id);
  const ownActions = observation.ownNightActions ?? [];
  const allowed = (kind: "check" | "poison" | "guard", id: number) => {
    const policy =
      bound?.activation === "lucky" ||
      bound?.activation === "black_market" ||
      observation.abilities.some(
        (ability) =>
          (ability.activation === "lucky" || ability.activation === "black_market") &&
          ability.kind ===
            (kind === "check" ? "seer_check" : kind === "guard" ? "guard" : "potion"),
      ) ||
      ownActions.some((row) => row.kind === kind && row.lucky);
    return (
      !policy ||
      !ownActions.some(
        (row) =>
          row.kind === kind &&
          row.targetId === id &&
          (row.day === request.context.day ||
            (kind === "guard" && row.day === request.context.day - 1)),
      )
    );
  };
  return {
    observation,
    request,
    knownAliveIds,
    ownState,
    teammateIds,
    actor,
    others,
    pick,
    random,
    style,
    bound,
    allowed,
  };
}
