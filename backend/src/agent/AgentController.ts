import {
  PlayerAction,
  RoleType,
  AgentOutput,
  BroadcastEventType,
  ActionType,
  GamePhase,
  World,
  IdentityComponent,
  StatusComponent,
  ModelConfig,
} from "../core/types";
import type { Environment } from "../core/Environment";
import { OpenAIClient } from "../llm/OpenAIClient";
import { ActionValidator } from "./ActionValidator";
import { Broadcaster } from "../broadcaster/Broadcaster";
import { withRetry, defaultRetryOptions } from "../llm/Retry";
import { PromptPipeline } from "./PromptPipeline";

export class AgentController {
  private env: Environment;
  private validator: ActionValidator;
  private broadcaster: Broadcaster;
  private world: World;
  private modelDefaults: ModelConfig;

  constructor(
    env: Environment,
    broadcaster: Broadcaster,
    world: World,
    modelDefaults: ModelConfig,
  ) {
    this.env = env;
    this.broadcaster = broadcaster;
    this.validator = new ActionValidator();
    this.world = world;
    this.modelDefaults = modelDefaults;
  }

  async runAgentCycle(entityId: number): Promise<PlayerAction> {
    // 1. 通过entityId从ECS World获取组件
    const identity = this.world.getComponent<IdentityComponent>(
      entityId,
      "IdentityComponent",
    );
    const status = this.world.getComponent<StatusComponent>(
      entityId,
      "StatusComponent",
    );

    if (!identity) {
      throw new Error(`IdentityComponent not found for entity ${entityId}`);
    }
    if (!status) {
      throw new Error(`StatusComponent not found for entity ${entityId}`);
    }

    // 2. 广播Agent开始思考
    this.broadcaster.broadcast({
      type: BroadcastEventType.AgentThinking,
      data: {
        playerId: entityId,
        roleType: identity.roleType,
      },
      timestamp: Date.now(),
    });

    // 3. 使用PromptPipeline构建提示词
    const promptPipeline = new PromptPipeline(this.env, entityId, this.world);
    const currentPhase = this.env.getGameState().phase;
    const prompt = promptPipeline.buildPrompt(
      identity.roleType,
      currentPhase,
      true,
    );

    // 4. 直接调用OpenAIClient，使用配置的modelDefaults
    const client = new OpenAIClient(this.modelDefaults);

    // 5. 调用LLM并解析响应
    const systemPrompt = `你是${identity.roleType}，请按照游戏规则行动。`;
    const response = await withRetry(
      () => client.chat(systemPrompt, prompt),
      defaultRetryOptions,
    );

    // 6. 解析JSON响应
    const { action, thought } = this.parseLLMResponse(response.thought);

    // 7. 验证行动
    const gameState = this.env.getGameState();
    const validation = this.validator.validate(
      {
        thought,
        action: {
          type: action.actionType,
          targetId: action.targetId,
          content: action.content,
        },
      },
      identity.roleType,
      entityId,
      gameState,
    );

    if (!validation.valid) {
      console.warn(
        `Invalid action from agent ${entityId}: ${validation.error}`,
      );
    }

    const validatedAction = validation.corrected!;
    this.applySideEffects(validatedAction, identity);
    this.env.publishAction(validatedAction);

    // 8. 广播思考完成
    this.broadcaster.broadcast({
      type: BroadcastEventType.AgentThoughtComplete,
      data: {
        playerId: entityId,
        roleType: identity.roleType,
        thought: validatedAction.thought,
        action: {
          type: validatedAction.actionType,
          targetId: validatedAction.targetId,
          content: validatedAction.content,
        },
      },
      timestamp: Date.now(),
    });

    // 9. 广播玩家行动
    this.broadcaster.broadcast({
      type: BroadcastEventType.PlayerAction,
      data: validatedAction,
      timestamp: Date.now(),
    });

    return validatedAction;
  }

  /**
   * 解析LLM响应，提取JSON格式的行动和思考
   */
  private parseLLMResponse(response: string): { action: any; thought: string } {
    // 尝试提取JSON部分
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in LLM response");
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // 检查是否包含thought字段
      if (!parsed.thought) {
        throw new Error("Missing 'thought' field in LLM response");
      }

      // 检查是否包含action字段
      if (!parsed.action) {
        throw new Error("Missing 'action' field in LLM response");
      }

      return {
        thought: parsed.thought,
        action: parsed.action,
      };
    } catch (error) {
      throw new Error(`Failed to parse LLM response as JSON: ${error}`);
    }
  }

  private applySideEffects(
    action: PlayerAction,
    identity: IdentityComponent,
  ): void {
    const state = this.env.getGameState();

    switch (action.actionType) {
      case ActionType.Kill: {
        break;
      }

      case ActionType.Save: {
        if (state.nightResult?.killedByWolf !== undefined) {
          state.witchHasAntidote = false;
          const killed = state.nightResult.killedByWolf;
          state.nightResult.savedByWitch = killed;
          state.nightResult.deadPlayerIds =
            state.nightResult.deadPlayerIds.filter(
              (id: number) => id !== killed,
            );
          this.env.setGameState({
            witchHasAntidote: false,
            nightResult: state.nightResult,
          });
        }
        break;
      }

      case ActionType.Poison: {
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

      case ActionType.Check: {
        if (action.targetId !== undefined) {
          const targetIdentity = this.world.getComponent<IdentityComponent>(
            action.targetId,
            "IdentityComponent",
          );
          if (targetIdentity) {
            this.env.setGameState({
              lastChecked: {
                targetId: action.targetId,
                isWolf: targetIdentity.faction === "wolf",
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
    if (
      state.nightResult &&
      !state.nightResult.deadPlayerIds.includes(playerId)
    ) {
      state.nightResult.deadPlayerIds.push(playerId);
    }
  }
}
