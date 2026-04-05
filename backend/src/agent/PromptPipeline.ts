import {
  GamePhase,
  RoleType,
  GameState,
  Player,
  PlayerAction,
  ActionType,
  World,
  IdentityComponent,
  StatusComponent,
  SkillComponent,
} from "../core/types";
import { Environment } from "../core/Environment";

/**
 * Prompt 管线 - 根据 ARCHITECTURE.md 规范实现
 *
 * 管线顺序：
 * BaseRules → Persona (性格与记忆) → Role Context → Status Modifiers (禁言/警长) → Public/Private History
 */
export class PromptPipeline {
  private env: Environment;
  private playerId: number;
  private world: World;

  constructor(env: Environment, playerId: number, world: World) {
    this.env = env;
    this.playerId = playerId;
    this.world = world;
  }

  /**
   * 构建完整的 Prompt
   */
  buildPrompt(
    roleType: RoleType,
    currentPhase: GamePhase,
    includePrivateMemory: boolean = true,
  ): string {
    const gameState = this.env.getGameState();

    let prompt = "";

    // 1. BaseRules - 基础游戏规则
    prompt += this.buildBaseRules();

    // 2. Persona - 性格与记忆
    prompt += this.buildPersona(roleType, this.playerId);

    // 3. Role Context - 角色上下文
    prompt += this.buildRoleContext(roleType, currentPhase, gameState);

    // 4. Status Modifiers - 状态修饰器（禁言/警长等）
    prompt += this.buildStatusModifiers(this.playerId, gameState);

    // 5. Public History - 公开历史记录
    prompt += this.buildPublicHistory(this.playerId, gameState);

    // 6. Private Memory - 私有记忆（可选）
    if (includePrivateMemory) {
      prompt += this.buildPrivateMemory(this.playerId);
    }

    // 7. Action Context - 行动上下文
    prompt += this.buildActionContext(roleType, currentPhase, gameState);

    // 8. Output Format - 输出格式要求
    prompt += this.buildOutputFormat();

    return prompt;
  }

  /**
   * 获取ECS组件
   */
  private getIdentityComponent(entityId: number): IdentityComponent | null {
    return this.world.getComponent<IdentityComponent>(
      entityId,
      "IdentityComponent",
    );
  }

  private getStatusComponent(entityId: number): StatusComponent | null {
    return this.world.getComponent<StatusComponent>(
      entityId,
      "StatusComponent",
    );
  }

  private getSkillComponent(entityId: number): SkillComponent | null {
    return this.world.getComponent<SkillComponent>(entityId, "SkillComponent");
  }

  /**
   * 获取玩家私有记忆（从ECS组件中读取）
   */
  private getPrivateMemory(entityId: number): string[] {
    // ECS架构中私有记忆通过MemoryComponent存储
    // 当前暂时返回空数组，待MemoryComponent实现
    return [];
  }

  /**
   * 获取玩家已使用的技能（从ECS组件中读取）
   */
  private getSkillsUsed(entityId: number): string[] {
    // SkillComponent只包含可用技能列表，不跟踪使用状态
    // 当前ECS架构未实现技能使用跟踪，暂时返回空数组
    return [];
  }

  /**
   * 1. BaseRules - 基础游戏规则
   */
  private buildBaseRules(): string {
    return `# 游戏规则

你正在参与一个狼人杀游戏。以下是基本规则：

## 角色与阵营
- **狼人阵营**：狼人
- **村民阵营**：村民、预言家、女巫

## 游戏流程
1. 夜晚阶段：
   - 狼人行动：狼人选择一名玩家杀死
   - 预言家行动：预言家选择一名玩家查验身份
   - 女巫行动：女巫可以选择使用解药救人，或使用毒药杀人

2. 白天阶段：
   - 公布夜晚结果
   - 顺序发言
   - 投票放逐

## 胜利条件
- 狼人胜利：狼人数量 ≥ 村民数量
- 村民胜利：所有狼人死亡

`;
  }

  /**
   * 2. Persona - 性格与记忆
   */
  private buildPersona(roleType: RoleType, entityId: number): string {
    const identity = this.getIdentityComponent(entityId);
    const privateMemory = this.getPrivateMemory(entityId);

    let persona = `# 你的角色

你是 **${this.getRoleChinese(roleType)}**，属于 **${this.getFactionChinese(identity?.faction || "villager")}**。

`;

    if (privateMemory.length > 0) {
      persona += `## 你的记忆
${privateMemory.map((memory, index) => `${index + 1}. ${memory}`).join("\n")}

`;
    }

    return persona;
  }

  /**
   * 3. Role Context - 角色上下文
   */
  private buildRoleContext(
    roleType: RoleType,
    currentPhase: GamePhase,
    gameState: GameState,
  ): string {
    let context = `# 当前游戏状态

当前阶段：${this.getPhaseChinese(currentPhase)}
当前轮次：第${gameState.round}轮

`;

    // 根据角色类型添加特定上下文
    switch (roleType) {
      case RoleType.Wolf:
        context += this.buildWolfContext(gameState);
        break;
      case RoleType.Seer:
        context += this.buildSeerContext(gameState);
        break;
      case RoleType.Witch:
        context += this.buildWitchContext(gameState);
        break;
      case RoleType.Villager:
        context += this.buildVillagerContext(gameState);
        break;
    }

    return context;
  }

  /**
   * 4. Status Modifiers - 状态修饰器（禁言/警长等）
   */
  private buildStatusModifiers(entityId: number, gameState: GameState): string {
    const status = this.getStatusComponent(entityId);
    if (!status) return "";

    let modifiers = "";

    if (status.isSheriff) {
      modifiers +=
        "你是本局的 **警长**，拥有1.5票的投票权，并且在平票时可以决定放逐谁。\n\n";
    }

    if (status.isMuted) {
      modifiers += "你当前 **被禁言**，本轮不能发言。\n\n";
    }

    if (modifiers) {
      return `# 状态修饰\n${modifiers}`;
    }

    return "";
  }

  /**
   * 5. Public History - 公开历史记录
   */
  private buildPublicHistory(entityId: number, gameState: GameState): string {
    const visibleHistory = this.env.getVisibleHistory(entityId);

    if (!visibleHistory || visibleHistory.length === 0) {
      return "# 游戏历史\n暂无历史记录。\n\n";
    }

    return `# 游戏历史
${visibleHistory.map((entry, index) => `${index + 1}. ${entry}`).join("\n")}

`;
  }

  /**
   * 6. Private Memory - 私有记忆
   */
  private buildPrivateMemory(entityId: number): string {
    const privateMemory = this.getPrivateMemory(entityId);

    if (privateMemory.length === 0) {
      return "";
    }

    return `# 你的私有记忆
这些信息只有你自己知道：
${privateMemory.map((memory, index) => `${index + 1}. ${memory}`).join("\n")}

`;
  }

  /**
   * 7. Action Context - 行动上下文
   */
  private buildActionContext(
    roleType: RoleType,
    currentPhase: GamePhase,
    gameState: GameState,
  ): string {
    let context = `# 你需要做什么？

当前阶段：${this.getPhaseChinese(currentPhase)}

`;

    switch (currentPhase) {
      case GamePhase.WolfAction:
        if (roleType === RoleType.Wolf) {
          context += "作为狼人，你需要选择一名玩家杀死。\n";
        } else {
          context += "你不是狼人，本轮不能行动。\n";
        }
        break;

      case GamePhase.SeerAction:
        if (roleType === RoleType.Seer) {
          context += "作为预言家，你需要选择一名玩家查验身份。\n";
        } else {
          context += "你不是预言家，本轮不能行动。\n";
        }
        break;

      case GamePhase.WitchAction:
        if (roleType === RoleType.Witch) {
          const skillsUsed = this.getSkillsUsed(this.playerId);
          const hasAntidote = !skillsUsed.includes("antidote");
          const hasPoison = !skillsUsed.includes("poison");

          context += "作为女巫，你有以下选择：\n";
          if (hasAntidote) {
            context += "- 使用解药救活被狼人杀死的玩家（只能用一次）\n";
          }
          if (hasPoison) {
            context += "- 使用毒药杀死一名玩家（只能用一次）\n";
          }
          if (!hasAntidote && !hasPoison) {
            context += "- 你已经用完了所有药水，本轮不能行动。\n";
          }
        } else {
          context += "你不是女巫，本轮不能行动。\n";
        }
        break;

      case GamePhase.SequentialSpeech:
        context += "你需要进行发言，分析局势并表达你的观点。\n";
        break;

      case GamePhase.Vote:
        context += "你需要投票放逐一名玩家。\n";
        break;

      default:
        context += "请等待游戏进行。\n";
    }

    return context;
  }

  /**
   * 8. Output Format - 输出格式要求
   */
  private buildOutputFormat(): string {
    return `# 输出格式要求

你需要以JSON格式输出你的思考和行动：

\`\`\`json
{
  "thought": "你的思考过程，包括推理、分析和决策理由。这部分内容对旁观者可见。",
  "action": {
    "type": "行动类型，必须是以下之一：kill, save, poison, check, speak, vote, no_action",
    "targetId": "目标玩家ID（可选，针对kill/poison/check/vote行动）",
    "content": "发言内容（可选，针对speak行动）"
  }
}
\`\`\`

**重要提示**：
1. "thought" 字段必须包含你的完整思考过程
2. "action" 字段必须严格按照上述格式
3. 你只能输出JSON，不要添加其他任何文本

请开始你的思考：
`;
  }

  /**
   * 狼人特定上下文
   */
  private buildWolfContext(gameState: GameState): string {
    return `## 狼人特定信息
- 你的目标是杀死所有村民阵营的玩家
- 每晚你可以与其他狼人讨论并选择一名玩家杀死
- 注意隐藏自己的身份，避免被预言家查验到

`;
  }

  /**
   * 预言家特定上下文
   */
  private buildSeerContext(gameState: GameState): string {
    return `## 预言家特定信息
- 每晚你可以查验一名玩家的阵营（狼人/村民）
- 查验结果只有你自己知道
- 你的目标是帮助村民找出所有狼人

`;
  }

  /**
   * 女巫特定上下文
   */
  private buildWitchContext(gameState: GameState): string {
    const hasAntidote = gameState.witchHasAntidote;
    const hasPoison = gameState.witchHasPoison;

    return `## 女巫特定信息
- 你有一瓶解药和一瓶毒药，每瓶只能用一次
- 解药可以救活被狼人杀死的玩家
- 毒药可以杀死一名玩家
- 解药状态：${hasAntidote ? "可用" : "已使用"}
- 毒药状态：${hasPoison ? "可用" : "已使用"}

`;
  }

  /**
   * 村民特定上下文
   */
  private buildVillagerContext(gameState: GameState): string {
    return `## 村民特定信息
- 你没有特殊能力
- 需要通过发言和投票找出狼人
- 与其他村民合作，分析局势

`;
  }

  /**
   * 辅助函数：获取角色中文名称
   */
  private getRoleChinese(roleType: RoleType): string {
    switch (roleType) {
      case RoleType.Wolf:
        return "狼人";
      case RoleType.Seer:
        return "预言家";
      case RoleType.Witch:
        return "女巫";
      case RoleType.Villager:
        return "村民";
      default:
        return roleType;
    }
  }

  /**
   * 辅助函数：获取阵营中文名称
   */
  private getFactionChinese(faction: string): string {
    switch (faction) {
      case "wolf":
        return "狼人阵营";
      case "villager":
        return "村民阵营";
      default:
        return faction;
    }
  }

  /**
   * 辅助函数：获取阶段中文名称
   */
  private getPhaseChinese(phase: GamePhase): string {
    switch (phase) {
      case GamePhase.NightStart:
        return "夜晚开始";
      case GamePhase.WolfAction:
        return "狼人行动";
      case GamePhase.SeerAction:
        return "预言家行动";
      case GamePhase.WitchAction:
        return "女巫行动";
      case GamePhase.DayStart:
        return "白天开始";
      case GamePhase.PublishNightResult:
        return "公布夜晚结果";
      case GamePhase.CheckWinCondition:
        return "检查胜利条件";
      case GamePhase.SequentialSpeech:
        return "顺序发言";
      case GamePhase.Vote:
        return "投票";
      case GamePhase.GameOver:
        return "游戏结束";
      default:
        return phase;
    }
  }
}
