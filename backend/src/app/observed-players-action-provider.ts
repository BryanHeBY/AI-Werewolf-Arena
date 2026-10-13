/**
 * 负责把原 World 经共用捕获转换为每个席位的受限策略输入。输入为只读板子、座位策略表与请求；
 * 输出为策略返回的工具，不将对手真实 camp 直接当作玩家知识，也不修改规则或提交资源。
 * 完整观察由游戏侧 owner 形成并脱离冻结；此适配器保留请求、知识与策略调用的原时点。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { ActionProvider, ActionRequest, ToolCall, World } from "../core";
import { PlayerPromptPolicy } from "../ai/agents/player/player_prompt_policy";
import type { ObservedPlayerStrategy } from "../game/observation/player-observation";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../game/mechanisms";

/** 特权捕获适配器只把共用玩家投影交给受限策略。 */
export class ObservedPlayersActionProvider implements ActionProvider {
  private readonly policy: PlayerPromptPolicy;

  constructor(
    world: World,
    private readonly strategies: ReadonlyMap<number, ObservedPlayerStrategy>,
    boardConfig: ReadonlyBoardConfig,
  ) {
    this.policy = new PlayerPromptPolicy(world, {
      boardConfig,
      toolSpecRegistry: getDefaultToolSpecRegistry(),
      roleCatalog: getDefaultRoleCatalog(),
      targetHintRegistry: getDefaultTargetHintRegistry(),
      configRenderRegistry: getDefaultConfigRenderRegistry(),
      phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    });
  }

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const strategy = this.strategies.get(request.actorId);
    if (!strategy) throw new Error("observed_player_strategy_missing");
    return strategy.decide(this.policy.buildObservation(request));
  }
}
