import type { RandomDraws, ToolCall } from "../../../../core";
import type { PlayerObservation } from "../../player/observation";

export type BotStyle = "active" | "conservative" | "competitive" | "random";
export type ObservedBotContext = ReturnType<typeof createObservedBotContext>;
/** undefined keeps searching; null is an intentional terminal no-action. */
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
