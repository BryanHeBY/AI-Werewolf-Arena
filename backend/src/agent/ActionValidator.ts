import {
  PlayerAction,
  AgentOutput,
  GameState,
  RoleType,
  ActionType,
  GamePhase,
} from "../core/types";
import { OpenAIClient } from "../llm/OpenAIClient";
import type { ModelConfig } from "../core/types";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  corrected?: PlayerAction;
}

export interface FallbackOptions {
  maxRetries: number;
  onRetry?: (attempt: number, error: string) => void;
}

const DEFAULT_FALLBACK_OPTIONS: FallbackOptions = {
  maxRetries: 3,
};

/**
 * ActionValidator - 验证玩家动作并提供 LLM Fallback 机制
 *
 * 主要功能：
 * 1. 验证 LLM 输出（目标是否存活、阶段是否匹配、技能CD等）
 * 2. 调用 LLM 并解析输出
 * 3. 解析失败时自动重试（最多3次）
 * 4. 重试失败后执行强制降级策略
 */
export class ActionValidator {
  private fallbackOptions: FallbackOptions;

  constructor(fallbackOptions: FallbackOptions = DEFAULT_FALLBACK_OPTIONS) {
    this.fallbackOptions = fallbackOptions;
  }

  /**
   * 验证 LLM 输出的动作是否合法
   * 保持现有验证逻辑不变
   */
  validate(
    output: AgentOutput,
    roleType: RoleType,
    playerId: number,
    gameState: GameState,
  ): ValidationResult {
    // Check if action type is allowed for this role in current phase
    const allowedActions = this.getAllowedActionsForRole(
      roleType,
      gameState.phase,
    );
    if (!allowedActions.includes(output.action.type)) {
      return {
        valid: false,
        error: `Role ${roleType} cannot perform action ${output.action.type} in phase ${gameState.phase}`,
        corrected: this.getDefaultAction(
          roleType,
          playerId,
          output.thought,
          gameState,
        ),
      };
    }

    // Check target is alive if required
    if (
      this.requiresTarget(output.action.type) &&
      output.action.targetId === undefined
    ) {
      return {
        valid: false,
        error: `Action ${output.action.type} requires a target`,
        corrected: this.getDefaultAction(roleType, playerId, output.thought),
      };
    }

    if (
      this.requiresTarget(output.action.type) &&
      output.action.targetId !== undefined
    ) {
      const target = gameState.players.find(
        (p) => p.id === output.action.targetId,
      );
      if (!target) {
        return {
          valid: false,
          error: `Target player ${output.action.targetId} does not exist`,
          corrected: this.getDefaultAction(
            roleType,
            playerId,
            output.thought,
            gameState,
          ),
        };
      }
      if (!target.isAlive && output.action.type !== ActionType.Vote) {
        return {
          valid: false,
          error: `Target player ${output.action.targetId} is already dead`,
          corrected: this.getDefaultAction(
            roleType,
            playerId,
            output.thought,
            gameState,
          ),
        };
      }
    }

    // Check speech has content
    if (output.action.type === ActionType.Speak && !output.action.content) {
      return {
        valid: false,
        error: "Speak action requires content",
        corrected: {
          playerId,
          roleType,
          actionType: ActionType.Speak,
          content: "我没有什么想说的。",
          thought: output.thought,
          timestamp: Date.now(),
        },
      };
    }

    // Witch specific validation - check if she has the potion
    if (roleType === RoleType.Witch) {
      if (
        output.action.type === ActionType.Save &&
        !gameState.witchHasAntidote
      ) {
        return {
          valid: false,
          error: "Witch already used antidote",
          corrected: this.getDefaultAction(
            roleType,
            playerId,
            output.thought,
            gameState,
          ),
        };
      }
      if (
        output.action.type === ActionType.Poison &&
        !gameState.witchHasPoison
      ) {
        return {
          valid: false,
          error: "Witch already used poison",
          corrected: this.getDefaultAction(
            roleType,
            playerId,
            output.thought,
            gameState,
          ),
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

  /**
   * 使用正则解析 LLM 输出
   * 按照 ARCHITECTURE.md 规范使用 match(/\{[\s\S]*\}/)
   */
  parseLLMOutput(rawOutput: string): AgentOutput | null {
    // 提取 JSON 部分
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to extract JSON from LLM output");
      return null;
    }

    try {
      // 清理 JSON 字符串中的换行符等
      let cleanedJson = jsonMatch[0].replace(
        /"([^"\\]*(\\.[^"\\]*)*)"/g,
        (match) => {
          return match.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
        },
      );

      const parsed = JSON.parse(cleanedJson) as AgentOutput;

      // 验证必要的字段
      if (!parsed.thought || typeof parsed.thought !== "string") {
        console.error('Missing or invalid "thought" field');
        return null;
      }
      if (!parsed.action || typeof parsed.action !== "object") {
        console.error('Missing or invalid "action" field');
        return null;
      }
      if (!parsed.action.type || !this.isValidActionType(parsed.action.type)) {
        console.error(`Invalid action type: ${parsed.action.type}`);
        return null;
      }

      return parsed;
    } catch (error) {
      console.error("Failed to parse JSON from LLM:", error);
      return null;
    }
  }

  /**
   * 调用 LLM 并验证输出，支持重试机制
   * 当 LLM 输出解析失败时，重试最多 maxRetries 次
   */
  async validateWithLLM(
    systemPrompt: string,
    userMessage: string,
    modelConfig: ModelConfig,
    roleType: RoleType,
    playerId: number,
    gameState: GameState,
  ): Promise<ValidationResult> {
    const client = new OpenAIClient(modelConfig);
    let lastError: string = "Unknown error";

    for (
      let attempt = 1;
      attempt <= this.fallbackOptions.maxRetries;
      attempt++
    ) {
      try {
        // 调用 LLM
        const rawOutput = await client.chat(systemPrompt, userMessage);

        // 验证 LLM 输出
        const validation = this.validate(
          rawOutput,
          roleType,
          playerId,
          gameState,
        );
        if (validation.valid) {
          return validation;
        }

        // 如果验证失败，记录错误并重试
        lastError = validation.error || "Validation failed";
        console.warn(`Attempt ${attempt} validation failed: ${lastError}`);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error(`Attempt ${attempt} failed: ${lastError}`);
      }

      // 触发重试回调
      if (this.fallbackOptions.onRetry) {
        this.fallbackOptions.onRetry(attempt, lastError);
      }
    }

    // 连续失败，使用强制降级策略
    console.warn(
      `LLM failed ${this.fallbackOptions.maxRetries} times, using fallback action`,
    );
    const fallbackAction = this.getFallbackAction(
      roleType,
      playerId,
      gameState,
    );
    return {
      valid: false,
      error: `LLM failed after ${this.fallbackOptions.maxRetries} attempts: ${lastError}`,
      corrected: fallbackAction,
    };
  }

  /**
   * 根据当前阶段和角色返回降级动作
   * 按照 ARCHITECTURE.md 规范实现强制降级策略：
   * - 白天发言阶段：强制发言 "过"
   * - 夜晚行动阶段：强制 no_action
   * - 投票阶段：随机投票给存活玩家
   */
  getFallbackAction(
    roleType: RoleType,
    playerId: number,
    gameState: GameState,
  ): PlayerAction {
    const currentPhase = gameState.phase;
    const thought = "LLM failed, using fallback action";

    // 白天发言阶段 - 强制发言 "过"
    if (this.isSpeechPhase(currentPhase)) {
      return {
        playerId,
        roleType,
        actionType: ActionType.Speak,
        content: "过",
        thought,
        timestamp: Date.now(),
      };
    }

    // 夜晚行动阶段 - 强制 no_action
    if (this.isNightActionPhase(currentPhase)) {
      return {
        playerId,
        roleType,
        actionType: ActionType.NoAction,
        thought,
        timestamp: Date.now(),
      };
    }

    // 投票阶段 - 随机投票给存活玩家
    if (this.isVotePhase(currentPhase)) {
      const alivePlayers = gameState.players.filter(
        (p) => p.isAlive && p.id !== playerId,
      );
      if (alivePlayers.length > 0) {
        const randomTarget =
          alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        return {
          playerId,
          roleType,
          actionType: ActionType.Vote,
          targetId: randomTarget.id,
          thought,
          timestamp: Date.now(),
        };
      }
    }

    // 默认 fallback - no_action
    return {
      playerId,
      roleType,
      actionType: ActionType.NoAction,
      thought,
      timestamp: Date.now(),
    };
  }

  /**
   * 判断是否为发言阶段
   */
  private isSpeechPhase(phase: GamePhase): boolean {
    return [
      GamePhase.SequentialSpeech,
      GamePhase.Sheriff_Speech,
      GamePhase.PK_Speech,
    ].includes(phase);
  }

  /**
   * 判断是否为夜晚行动阶段
   */
  private isNightActionPhase(phase: GamePhase): boolean {
    return [
      GamePhase.WolfAction,
      GamePhase.SeerAction,
      GamePhase.WitchAction,
    ].includes(phase);
  }

  /**
   * 判断是否为投票阶段
   */
  private isVotePhase(phase: GamePhase): boolean {
    return [GamePhase.Vote, GamePhase.Sheriff_Vote].includes(phase);
  }

  /**
   * 验证动作类型是否有效
   */
  private isValidActionType(type: string): boolean {
    return [
      "kill",
      "save",
      "poison",
      "check",
      "speak",
      "vote",
      "no_action",
    ].includes(type);
  }

  private getAllowedActionsForRole(
    roleType: RoleType,
    phase: string,
  ): ActionType[] {
    switch (roleType) {
      case RoleType.Wolf:
        if (phase === "Wolf_Action")
          return [ActionType.Kill, ActionType.NoAction];
        if (phase === "Sequential_Speech" || phase === "Vote")
          return [ActionType.Speak, ActionType.Vote];
        return [];

      case RoleType.Seer:
        if (phase === "Seer_Action")
          return [ActionType.Check, ActionType.NoAction];
        if (phase === "Sequential_Speech" || phase === "Vote")
          return [ActionType.Speak, ActionType.Vote];
        return [];

      case RoleType.Witch:
        if (phase === "Witch_Action")
          return [ActionType.Save, ActionType.Poison, ActionType.NoAction];
        if (phase === "Sequential_Speech" || phase === "Vote")
          return [ActionType.Speak, ActionType.Vote];
        return [];

      case RoleType.Villager:
        if (phase === "Sequential_Speech" || phase === "Vote")
          return [ActionType.Speak, ActionType.Vote];
        return [];

      default:
        return [];
    }
  }

  private requiresTarget(type: ActionType): boolean {
    return [
      ActionType.Kill,
      ActionType.Poison,
      ActionType.Check,
      ActionType.Vote,
    ].includes(type);
  }

  private getDefaultAction(
    roleType: RoleType,
    playerId: number,
    thought: string,
    gameState?: GameState,
  ): PlayerAction {
    // If we're in speech phase, default to a generic speech instead of no_action
    if (gameState && gameState.phase === "Sequential_Speech") {
      return {
        playerId,
        roleType,
        actionType: ActionType.Speak,
        content:
          "目前信息还不多，我暂时没有什么想说的，听一下后面人的发言再做判断。",
        thought,
        timestamp: Date.now(),
      };
    }
    // If we're in vote phase, but this shouldn't happen since validation requires target
    if (gameState && gameState.phase === "Vote") {
      // Default to voting the first alive wolf suspect - but this rarely happens
      // Just pick the first alive player that's not us
      const firstAlive = gameState.players.find(
        (p) => p.isAlive && p.id !== playerId,
      );
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
