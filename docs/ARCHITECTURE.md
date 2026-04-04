# AI-Werewolf-Arena V2 架构规范

## 1. 概述

V2 版本的核心是 **Event-Driven ECS + Phase Stack（阶段栈引擎）**，彻底废弃 V1 的数组轮询状态机，以支持复杂的打断机制（如上警、平票、自爆）。

---

## 2. Phase Stack（阶段栈引擎）规范

### 2.1 数据结构

Phase Stack 是一个 LIFO（后进先出）栈，每个栈节点必须包含 `phase` 和可选的 `context`（上下文），用于处理特定目标的阶段（如平票 PK 只有特定两人能发言）。

```typescript
// 必须在 backend/src/core/types.ts 中定义
interface StackNode {
  phase: GamePhase;
  context?: Record<string, any>;
}

// 游戏状态中新增 phaseStack 字段
interface GameState {
  // ... 现有字段 ...
  phaseStack: StackNode[];
}
```

### 2.2 GamePhase 枚举更新

必须在 `backend/src/core/types.ts` 中新增以下 GamePhase 枚举值：

```typescript
export enum GamePhase {
  // ... 现有 V1 阶段 ...
  Sheriff_Run = "Sheriff_Run", // 决定是否上警
  Sheriff_Speech = "Sheriff_Speech", // 上警发言
  Sheriff_Vote = "Sheriff_Vote", // 警长投票
  PK_Speech = "PK_Speech", // PK 发言
  Night_Start = "Night_Start",
  Self_Destruct = "Self_Destruct", // 狼人自爆
}
```

### 2.3 状态机防死循环机制

在 Phase Stack 规范中，必须明确加入最大流转深度阈值，防止 Node.js 进程卡死。

**阈值设置：** `maxDepth = 50`

**伪代码实现示例：**

```typescript
// 在 GameEngine.ts 的主循环中
private async runStateMachine(): Promise<void> {
  let depth = 0;
  const MAX_DEPTH = 50;

  while (this.isRunning) {
    depth++;

    // 防死循环检查
    if (depth > MAX_DEPTH) {
      console.error("Phase stack depth limit exceeded! Forcing game over.");
      const stack = this.env.getGameState().phaseStack;
      stack.clear();
      stack.push({ phase: GamePhase.GameOver });
      this.env.setGameState({ winner: Faction.Wolf }); // 或者根据规则决定
      break;
    }

    const stack = this.env.getGameState().phaseStack;
    if (stack.length === 0) {
      break;
    }

    const currentNode = stack.pop()!;
    try {
      await this.processPhase(currentNode.phase, currentNode.context);
    } catch (error) {
      console.error("Error processing phase:", error);
    }
  }
}
```

### 2.4 核心流转场景示例

以下场景必须严格按照示例实现，防止后端跑偏。

---

#### 场景 1：标准的新一天 (Day_Start)

每天天亮，法官进行压栈（注意是逆序压栈，后进先出）。

**伪代码实现示例：**

```typescript
// 在 GameEngine.ts 中
function pushDayStack(round: number) {
  const stack = this.env.getGameState().phaseStack;

  // 逆序压栈（后进先出）
  stack.push({ phase: GamePhase.CheckWinCondition });
  stack.push({ phase: GamePhase.Vote });
  stack.push({ phase: GamePhase.SequentialSpeech });
  stack.push({ phase: GamePhase.PublishNightResult });

  // 如果是第一天，额外插入上警栈
  if (round === 1) {
    this.pushSheriffElectionStack(stack);
  }
}
```

---

#### 场景 2：第一天上警竞选 (Sheriff_Election - 动态插入)

如果在 Day 1，天亮时需在 `PublishNightResult` 后额外插入上警栈：

**伪代码实现示例：**

```typescript
function pushSheriffElectionStack(stack: StackNode[]) {
  stack.push({ phase: GamePhase.Sheriff_Vote });
  stack.push({ phase: GamePhase.Sheriff_Speech });
  stack.push({ phase: GamePhase.Sheriff_Run });
}
```

---

#### 场景 3：平票 PK (Tie-Breaker - 嵌套循环)

如果在 `Vote` 阶段检测到 2 号和 4 号平票，**不要改变当前栈底**，直接向栈顶 `push` 新的子阶段：

**伪代码实现示例：**

```typescript
function handleTieVote(tiedPlayerIds: number[]) {
  const stack = this.env.getGameState().phaseStack;

  // 直接向栈顶 push 新的子阶段（不改变栈底）
  stack.push({
    phase: GamePhase.Vote,
    context: {
      onlyTargets: tiedPlayerIds,
      excludeVoters: tiedPlayerIds,
    },
  });
  stack.push({
    phase: GamePhase.PK_Speech,
    context: {
      speakers: [...tiedPlayerIds].reverse(), // PK 发言顺序反转
    },
  });
}
```

---

#### 场景 4：狼人白天自爆 (Self-Destruct - 终极打断)

如果在白天的任何阶段监听到 `submit_action` 为 `self_destruct`：

**伪代码实现示例：**

```typescript
function handleSelfDestruct(playerId: number) {
  const stack = this.env.getGameState().phaseStack;

  // 立即清空所有剩余白天阶段
  stack.clear();

  // 立即进入天黑
  stack.push({ phase: GamePhase.Night_Start });
}
```

---

## 3. 真正的 ECS 数据结构定义

ECS（Entity-Component-System）架构将原本写死的 `roleType` 拆分为多个可组合的 Component，支持通过组合获得技能，而不是用继承。

### 3.1 Entity（实体）

Entity 只是一个 ID，不包含任何数据或逻辑。

```typescript
type EntityId = number;

interface Entity {
  id: EntityId;
}
```

### 3.2 Component（组件）

Component 是纯数据容器，不包含逻辑。

#### IdentityComponent（身份组件）

```typescript
interface IdentityComponent {
  entityId: EntityId;
  roleType: RoleType;
  faction: Faction;
  name: string;
}
```

#### StatusComponent（状态组件）

```typescript
interface StatusComponent {
  entityId: EntityId;
  isAlive: boolean;
  isSheriff: boolean;
  isMuted: boolean; // 禁言
  muteUntilRound?: number;
}
```

#### SkillComponent（技能组件 - 插件接口）

```typescript
interface SkillComponent {
  entityId: EntityId;
  skills: Skill[];
}

interface Skill {
  skillId: string;
  name: string;
  cooldown: number; // 剩余冷却回合数
  canUseInPhase: GamePhase[];
  execute: (entityId: EntityId, targetId?: EntityId) => void;
}

// 示例：杀人技能
const KillSkill: Skill = {
  skillId: "kill",
  name: "杀人",
  cooldown: 0,
  canUseInPhase: [GamePhase.WolfAction],
  execute: (entityId: EntityId, targetId: EntityId) => {
    // 实现杀人逻辑
  },
};
```

### 3.3 机械狼示例 - 组合 Component 获得技能

机械狼不需要继承，只需要组合多个 Component：

```typescript
// 创建机械狼实体
const mechanicalWolfId = 1;

// 身份组件
const identity: IdentityComponent = {
  entityId: mechanicalWolfId,
  roleType: RoleType.Wolf,
  faction: Faction.Wolf,
  name: "机械狼",
};

// 状态组件
const status: StatusComponent = {
  entityId: mechanicalWolfId,
  isAlive: true,
  isSheriff: false,
  isMuted: false,
};

// 技能组件 - 组合多个技能
const skills: SkillComponent = {
  entityId: mechanicalWolfId,
  skills: [
    KillSkill, // 杀人技能（继承自狼人）
    LearnSkill, // 学习技能（机械狼特有）
    ShootSkill, // 开枪技能（机械狼特有）
  ],
};
```

---

## 4. 大模型防崩溃与 Fallback

### 4.1 正则解析 LLM 结果

必须使用正则 `match(/\{[\s\S]*\}/)` 解析 LLM 结果，提取 JSON 部分。

**伪代码实现示例：**

```typescript
function parseLLMOutput(rawOutput: string): AgentOutput | null {
  // 提取 JSON 部分
  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Failed to parse LLM JSON:", error);
    return null;
  }
}
```

### 4.2 强制降级策略

当 LLM 连续 3 次解析失败时，必须要有强制降级策略：

| 场景         | 降级策略               |
| ------------ | ---------------------- |
| 白天发言阶段 | 强制发言 "过"          |
| 夜晚行动阶段 | 强制 `no_action`       |
| 投票阶段     | 随机投票给一个存活玩家 |

**伪代码实现示例：**

```typescript
async function getAgentActionWithFallback(
  role: Role,
  maxRetries = 3,
): Promise<PlayerAction> {
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const output = await this.agentController.runAgentCycle(role);
      if (output) {
        return output;
      }
    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed:`, error);
    }
    retryCount++;
  }

  // 连续失败，使用强制降级策略
  console.warn("LLM failed 3 times, using fallback action");
  return this.getFallbackAction(role);
}

function getFallbackAction(role: Role): PlayerAction {
  const currentPhase = this.env.getGameState().phase;

  // 白天发言阶段
  if (
    currentPhase === GamePhase.SequentialSpeech ||
    currentPhase === GamePhase.Sheriff_Speech ||
    currentPhase === GamePhase.PK_Speech
  ) {
    return {
      playerId: role.playerId,
      roleType: role.roleType,
      actionType: ActionType.Speak,
      content: "过",
      thought: "LLM 失败，强制发言",
      timestamp: Date.now(),
    };
  }

  // 夜晚行动阶段
  if (
    currentPhase === GamePhase.WolfAction ||
    currentPhase === GamePhase.SeerAction ||
    currentPhase === GamePhase.WitchAction
  ) {
    return {
      playerId: role.playerId,
      roleType: role.roleType,
      actionType: ActionType.NoAction,
      thought: "LLM 失败，强制不行动",
      timestamp: Date.now(),
    };
  }

  // 投票阶段
  if (
    currentPhase === GamePhase.Vote ||
    currentPhase === GamePhase.Sheriff_Vote
  ) {
    const alivePlayers = this.env.getAlivePlayers();
    const randomTarget =
      alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    return {
      playerId: role.playerId,
      roleType: role.roleType,
      actionType: ActionType.Vote,
      targetId: randomTarget.id,
      thought: "LLM 失败，随机投票",
      timestamp: Date.now(),
    };
  }

  // 默认 fallback
  return {
    playerId: role.playerId,
    roleType: role.roleType,
    actionType: ActionType.NoAction,
    thought: "LLM 失败",
    timestamp: Date.now(),
  };
}
```

---

## 5. 强校验的 ECS 模式与 Prompt 管线

### 5.1 ActionValidator

必须实现 `ActionValidator`，所有 LLM 输出的 Action 必须经过以下校验：

| 校验项           | 说明                                       |
| ---------------- | ------------------------------------------ |
| 技能 CD          | 验证技能是否已使用过（如女巫的解药、毒药） |
| 目标是否存活     | 验证目标玩家是否存活                       |
| 当前阶段是否匹配 | 验证当前阶段是否允许该动作                 |

**伪代码实现示例：**

```typescript
class ActionValidator {
  validate(action: PlayerAction, env: Environment): boolean {
    // 1. 校验当前阶段是否匹配
    // 2. 校验目标是否存活
    // 3. 校验技能 CD
    return true;
  }
}
```

### 5.2 Prompt 管线

Prompt 组装必须流式化，顺序如下：

```
BaseRules → Persona (性格与记忆) → Role Context → Status Modifiers (禁言/警长) → Public/Private History
```

---

## 6. 现有代码修改指南

### 6.1 backend/src/core/types.ts

- 新增 `StackNode` 接口
- 新增 `GamePhase` 枚举值
- 在 `GameState` 接口中新增 `phaseStack` 字段
- 新增 ECS 相关接口：`Entity`、`IdentityComponent`、`StatusComponent`、`SkillComponent`、`Skill`

### 6.2 backend/src/core/GameEngine.ts

- 彻底废弃 `getNextPhase()` 方法
- 实现 Phase Stack 引擎
- 实现防死循环机制（maxDepth = 50）
- 实现上述 4 个核心流转场景
- 实现大模型 fallback 策略

---

## 7. 验收标准

- [ ] 彻底废弃数组轮询状态机
- [ ] 实现 Phase Stack 引擎，包含 `phase` 和 `context`
- [ ] 实现场景 1：标准的新一天
- [ ] 实现场景 2：第一天上警竞选
- [ ] 实现场景 3：平票 PK
- [ ] 实现场景 4：狼人白天自爆
- [ ] 实现状态机防死循环机制（maxDepth = 50）
- [ ] 实现真正的 ECS 数据结构（Entity、Component、Skill Plugin）
- [ ] 实现机械狼示例 - 组合 Component 获得技能
- [ ] 实现大模型正则解析（match(/\{[\s\S]\*\}/)）
- [ ] 实现大模型强制降级策略
- [ ] 实现 ActionValidator
- [ ] 实现流式化 Prompt 管线
