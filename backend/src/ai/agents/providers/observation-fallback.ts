/**
 * 负责生产回退的受限观察决策。输入是共同 PlayerObservation 和显式语言；
 * 输出为既有工具 handler 的竞争型行动，选择首个可见候选，不读取 World 或真实阵营。
 * 固定 next() 不推进游戏 RNG；原发言模板、狼聊形式和方向奇偶政策保持。
 * 自身当前资格与已知队友分开；请求旧工具名单不能恢复已被撤销的狼聊或刀资格。
 * 投影适配器仅传脱离且冻结的 DTO，资格、库存、目标和已付款动作仍由引擎重检。
 * 这是 F01 独立策略变化；无适合的观察行动时返回 null，不伪造严格必选动作。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ActionProvider, ActionRequest, ToolCall } from "../../../core/domain/actions";
import type {
  ObservedPlayerStrategy,
  PlayerObservation,
} from "../../../game/observation/player-observation";
import { createObservedBotContext } from "./observed_bot/context";
import { observedToolHandlers } from "./observed_bot/handlers";

const firstCandidate = Object.freeze({ next: () => 0 });

/** 仅持有展示语言；所有选择信息必须来自传入的玩家观察。 */
export class ObservationFallbackStrategy implements ObservedPlayerStrategy {
  constructor(private readonly locale: Locale) {}

  async decide(observation: PlayerObservation): Promise<ToolCall | null> {
    const context = createObservedBotContext(observation, firstCandidate, "competitive");
    for (const handler of observedToolHandlers) {
      if (!observation.request.allowedTools.includes(handler.tool)) continue;
      // F01：旧 allowedTools 只是请求名单；失效的自身狼聊／刀资格不能被回退恢复。
      // 两项资格分别判定，拒绝一个工具后仍按原顺序寻找其它已允许的候选。
      if (
        handler.tool === "speak_to_wolves" && observation.currentWolfActions.canChat !== true
      ) continue;
      if (
        handler.tool === "kill_vote" && observation.currentWolfActions.canVoteForKill !== true
      ) continue;
      if (handler.tool === "speak") {
        return {
          name: "speak",
          args: {
            text: text(
              this.locale,
              observation.request.context.trigger === "last_words"
                ? "fallback.last_words"
                : "fallback.speech",
              { actor: observation.request.actorId },
            ),
          },
        };
      }
      if (handler.tool === "speak_to_wolves") {
        return {
          name: "speak_to_wolves",
          args: { text: text(this.locale, "fallback.wolf_chat"), end_chat: false },
        };
      }
      if (handler.tool === "choose_direction") {
        return {
          name: "choose_direction",
          args: {
            direction: observation.request.actorId % 2 === 0 ? "clockwise" : "counter_clockwise",
          },
        };
      }
      const action = handler.decide(context);
      // null 是明确不行动，undefined 才继续检查下一工具；不能混淆两者。
      if (action !== undefined) return action;
    }
    return null;
  }
}

/**
 * 可信投影与受限策略之间的适配器。投影函数可以读取领域，但策略只接收 DTO。
 * 策略 Promise 直接返回；不增加等待层、预算、观察缓存或领域提交。
 */
export class ObservationFallbackActionProvider implements ActionProvider {
  constructor(
    private readonly project: (request: ActionRequest) => PlayerObservation,
    private readonly strategy: ObservedPlayerStrategy,
  ) {}

  getAction(request: ActionRequest): Promise<ToolCall | null> {
    return this.strategy.decide(this.project(request));
  }
}
