/**
 * Adapts original World observations to per-player unprivileged strategy decisions.
 * Inputs are the readonly board view and seat strategy map; outputs are returned
 * tools using the shared player projection and prompt policy. It never supplies
 * hidden camp truth as player knowledge or changes runtime rule parameters.
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { ActionProvider, ActionRequest, ToolCall, World } from "../../../core";
import { PlayerPromptPolicy } from "../player/player_prompt_policy";
import type { ObservedPlayerStrategy } from "../player/observation";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../game/mechanisms";

/** Privileged adapter supplies only the shared player projection to an unprivileged strategy. */
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
