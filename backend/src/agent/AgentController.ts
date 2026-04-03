import { Role, PlayerAction, RoleType, AgentOutput, BroadcastEventType, ActionType } from '../core/types';
import type { Environment } from '../core/Environment';
import { OpenAIClient } from '../llm/OpenAIClient';
import { ActionValidator } from './ActionValidator';
import { Broadcaster } from '../broadcaster/Broadcaster';
import { withRetry, defaultRetryOptions } from '../llm/Retry';

export class AgentController {
  private env: Environment;
  private validator: ActionValidator;
  private broadcaster: Broadcaster;

  constructor(env: Environment, broadcaster: Broadcaster) {
    this.env = env;
    this.broadcaster = broadcaster;
    this.validator = new ActionValidator();
  }

  async runAgentCycle(role: Role): Promise<PlayerAction> {
    this.broadcaster.broadcast({
      type: BroadcastEventType.AgentThinking,
      data: {
        playerId: role.playerId,
        roleType: role.roleType,
      },
      timestamp: Date.now(),
    });

    await role.observe(this.env);
    // LLM generates thought AND action together in act(), so call act first
    const action = await role.act();
    // Then get the generated thought from think()
    const thought = await role.think();

    const gameState = this.env.getGameState();
    const validation = this.validator.validate(
      { thought, action: {
        type: action.actionType,
        targetId: action.targetId,
        content: action.content,
      }},
      role.roleType,
      role.playerId,
      gameState
    );

    if (!validation.valid) {
      console.warn(`Invalid action from agent ${role.playerId}: ${validation.error}`);
    }

    const validatedAction = validation.corrected!;
    this.applySideEffects(validatedAction);
    this.env.publishAction(validatedAction);

    this.broadcaster.broadcast({
      type: BroadcastEventType.AgentThoughtComplete,
      data: {
        playerId: role.playerId,
        roleType: role.roleType,
        thought: validatedAction.thought,
        action: {
          type: validatedAction.actionType,
          targetId: validatedAction.targetId,
          content: validatedAction.content,
        },
      },
      timestamp: Date.now(),
    });

    this.broadcaster.broadcast({
      type: BroadcastEventType.PlayerAction,
      data: validatedAction,
      timestamp: Date.now(),
    });

    return validatedAction;
  }

  private applySideEffects(action: PlayerAction): void {
    const state = this.env.getGameState();
    
    switch (action.actionType) {
      case 'kill': {
        break;
      }

      case 'save': {
        if (state.nightResult?.killedByWolf !== undefined) {
          state.witchHasAntidote = false;
          const killed = state.nightResult.killedByWolf;
          state.nightResult.savedByWitch = killed;
          state.nightResult.deadPlayerIds = state.nightResult.deadPlayerIds.filter((id: number) => id !== killed);
          this.env.setGameState({
            witchHasAntidote: false,
            nightResult: state.nightResult,
          });
        }
        break;
      }

      case 'poison': {
        if (action.targetId !== undefined && state.nightResult) {
          state.witchHasPoison = false;
          state.nightResult.poisonedByWitch = action.targetId;
          this.tryAddDeadToNightResult(action.targetId);
          this.env.setGameState({
            witchHasPoison: false,
            nightResult: state.nightResult,
          });
        }
        break;
      }

      case 'check': {
        if (action.targetId !== undefined) {
          const target = this.env.getPlayerById(action.targetId);
          if (target) {
            this.env.setGameState({
              lastChecked: {
                targetId: action.targetId,
                isWolf: target.role.faction === 'wolf',
              },
            });
          }
        }
        break;
      }
    }
  }

  private tryAddDeadToNightResult(playerId: number): void {
    const state = this.env.getGameState();
    if (state.nightResult && !state.nightResult.deadPlayerIds.includes(playerId)) {
      state.nightResult.deadPlayerIds.push(playerId);
    }
  }
}
