/**
 * 负责按单个玩家的具名随机流和风格执行观察策略。输入为脱离 PlayerObservation；输出为工具选择或明确无行动。
 * 只保存此玩家的 RNG，不持有 World 或其他玩家原角色；候选知识不能授予资源写权，实际合法性仍由引擎重检。
 */
import type { ToolCall, RandomDraws } from "../../domain";
import type {
  ObservedPlayerStrategy,
  PlayerObservation,
} from "../observation/player-observation";
import { createObservedBotContext, type BotStyle } from "./observed-bot/context";
import { observedToolHandlers } from "./observed-bot/handlers";
export type { BotStyle } from "./observed-bot/context";

/** 只保有该玩家的具名 RNG，不取得 World 或其他玩家角色。 */
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
