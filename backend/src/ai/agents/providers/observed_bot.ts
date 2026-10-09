import type { ToolCall, RandomDraws } from "../../../core";
import type { ObservedPlayerStrategy, PlayerObservation } from "../player/observation";
import { createObservedBotContext, type BotStyle } from "./observed_bot/context";
import { observedToolHandlers } from "./observed_bot/handlers";
export type { BotStyle } from "./observed_bot/context";

/** Stateful only for this player's named RNG; never holds World or another player's role. */
export class ObservedBot implements ObservedPlayerStrategy {
  constructor(
    private readonly random: RandomDraws,
    private readonly style: BotStyle,
  ) {}
  async decide(observation: PlayerObservation): Promise<ToolCall | null> {
    const context = createObservedBotContext(observation, this.random, this.style);
    for (const handler of observedToolHandlers) {
      if (!observation.request.allowedTools.includes(handler.tool)) continue;
      const action = handler.decide(context);
      if (action !== undefined) return action;
    }
    throw new Error("observed_bot_action_not_supported");
  }
}
