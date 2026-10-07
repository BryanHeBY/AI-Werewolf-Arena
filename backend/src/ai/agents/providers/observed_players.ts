import type { ActionProvider, ActionRequest, BoardConfig, ToolCall, World } from "../../../core";
import { PlayerPromptPolicy } from "../player/player_prompt_policy";
import type { ObservedPlayerStrategy } from "../player/observation";
import { getDefaultConfigRenderRegistry, getDefaultPhaseStageLocalizationRegistry, getDefaultRoleCatalog, getDefaultTargetHintRegistry, getDefaultToolSpecRegistry } from "../../../game/mechanisms";

/** Privileged adapter supplies only the shared player projection to an unprivileged strategy. */
export class ObservedPlayersActionProvider implements ActionProvider {
  private readonly policy: PlayerPromptPolicy;

  constructor(world: World, private readonly strategies: ReadonlyMap<number, ObservedPlayerStrategy>, boardConfig: BoardConfig) {
    this.policy = new PlayerPromptPolicy(world, { boardConfig, toolSpecRegistry: getDefaultToolSpecRegistry(), roleCatalog: getDefaultRoleCatalog(),
      targetHintRegistry: getDefaultTargetHintRegistry(), configRenderRegistry: getDefaultConfigRenderRegistry(), phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry() });
  }

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const strategy = this.strategies.get(request.actorId);
    if (!strategy) throw new Error("observed_player_strategy_missing");
    return strategy.decide(this.policy.buildObservation(request));
  }
}
