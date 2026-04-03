import { PlayerAction, AgentOutput, GameState, RoleType, ActionType } from '../core/types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  corrected?: PlayerAction;
}

export class ActionValidator {
  validate(
    output: AgentOutput,
    roleType: RoleType,
    playerId: number,
    gameState: GameState
  ): ValidationResult {
    // Check if action type is allowed for this role in current phase
    const allowedActions = this.getAllowedActionsForRole(roleType, gameState.phase);
    if (!allowedActions.includes(output.action.type)) {
      return {
        valid: false,
        error: `Role ${roleType} cannot perform action ${output.action.type} in phase ${gameState.phase}`,
        corrected: this.getDefaultAction(roleType, playerId, output.thought, gameState),
      };
    }

    // Check target is alive if required
    if (this.requiresTarget(output.action.type) && output.action.targetId === undefined) {
      return {
        valid: false,
        error: `Action ${output.action.type} requires a target`,
        corrected: this.getDefaultAction(roleType, playerId, output.thought),
      };
    }

    if (this.requiresTarget(output.action.type) && output.action.targetId !== undefined) {
      const target = gameState.players.find(p => p.id === output.action.targetId);
      if (!target) {
        return {
          valid: false,
          error: `Target player ${output.action.targetId} does not exist`,
          corrected: this.getDefaultAction(roleType, playerId, output.thought, gameState),
        };
      }
      if (!target.isAlive && output.action.type !== ActionType.Vote) {
        return {
          valid: false,
          error: `Target player ${output.action.targetId} is already dead`,
          corrected: this.getDefaultAction(roleType, playerId, output.thought, gameState),
        };
      }
    }

    // Check speech has content
    if (output.action.type === ActionType.Speak && !output.action.content) {
      return {
        valid: false,
        error: 'Speak action requires content',
        corrected: {
          playerId,
          roleType,
          actionType: ActionType.Speak,
          content: '我没有什么想说的。',
          thought: output.thought,
          timestamp: Date.now(),
        },
      };
    }

    // Witch specific validation - check if she has the potion
     if (roleType === RoleType.Witch) {
        if (output.action.type === ActionType.Save && !gameState.witchHasAntidote) {
          return {
            valid: false,
            error: 'Witch already used antidote',
            corrected: this.getDefaultAction(roleType, playerId, output.thought, gameState),
          };
        }
        if (output.action.type === ActionType.Poison && !gameState.witchHasPoison) {
          return {
            valid: false,
            error: 'Witch already used poison',
            corrected: this.getDefaultAction(roleType, playerId, output.thought, gameState),
          };
        }
      }

    // All checks passed
    const playerAction: PlayerAction = {
      playerId,
      roleType,
      actionType: output.action.type,
      targetId: output.action.targetId,
      content: output.action.content,
      thought: output.thought,
      timestamp: Date.now(),
    };

    return { valid: true, corrected: playerAction };
  }

  private getAllowedActionsForRole(roleType: RoleType, phase: string): ActionType[] {
    switch (roleType) {
      case RoleType.Wolf:
        if (phase === 'Wolf_Action') return [ActionType.Kill, ActionType.NoAction];
        if (phase === 'Sequential_Speech' || phase === 'Vote') return [ActionType.Speak, ActionType.Vote];
        return [];
      
      case RoleType.Seer:
        if (phase === 'Seer_Action') return [ActionType.Check, ActionType.NoAction];
        if (phase === 'Sequential_Speech' || phase === 'Vote') return [ActionType.Speak, ActionType.Vote];
        return [];
      
      case RoleType.Witch:
        if (phase === 'Witch_Action') return [ActionType.Save, ActionType.Poison, ActionType.NoAction];
        if (phase === 'Sequential_Speech' || phase === 'Vote') return [ActionType.Speak, ActionType.Vote];
        return [];
      
      case RoleType.Villager:
        if (phase === 'Sequential_Speech' || phase === 'Vote') return [ActionType.Speak, ActionType.Vote];
        return [];
      
      default:
        return [];
    }
  }

  private requiresTarget(type: ActionType): boolean {
    return [
      ActionType.Kill,
      ActionType.Save,
      ActionType.Poison,
      ActionType.Check,
      ActionType.Vote,
    ].includes(type);
  }

  private getDefaultAction(roleType: RoleType, playerId: number, thought: string, gameState?: GameState): PlayerAction {
    // If we're in speech phase, default to a generic speech instead of no_action
    if (gameState && gameState.phase === 'Sequential_Speech') {
      return {
        playerId,
        roleType,
        actionType: ActionType.Speak,
        content: '目前信息还不多，我暂时没有什么想说的，听一下后面人的发言再做判断。',
        thought,
        timestamp: Date.now(),
      };
    }
    // If we're in vote phase, but this shouldn't happen since validation requires target
    if (gameState && gameState.phase === 'Vote') {
      // Default to voting the first alive wolf suspect - but this rarely happens
      // Just pick the first alive player that's not us
      const firstAlive = gameState.players.find(p => p.isAlive && p.id !== playerId);
      return {
        playerId,
        roleType,
        actionType: ActionType.Vote,
        targetId: firstAlive ? firstAlive.id : undefined,
        thought,
        timestamp: Date.now(),
      };
    }
    return {
      playerId,
      roleType,
      actionType: ActionType.NoAction,
      thought,
      timestamp: Date.now(),
    };
  }
}
