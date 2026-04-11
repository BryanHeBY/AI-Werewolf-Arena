# 狼人杀竞技场 - 后端

后端是 AI 狼人杀竞技场的核心游戏引擎，负责游戏流程控制、LLM 代理管理和网络通信。

## 技术栈

- **运行时**: Bun 1.2.6
- **HTTP 服务器**: Fastify v5.2.1
- **WebSocket**: Socket.IO v4.8.1
- **语言**: TypeScript
- **LLM 集成**: OpenAI API 兼容接口

## 项目结构

```
backend/
├── src/
│   ├── core/              # 核心游戏引擎
│   │   ├── roles/         # 角色实现
│   │   ├── GameEngine.ts  # 游戏状态机
│   │   ├── Environment.ts # 游戏环境和状态
│   │   └── types.ts       # 类型定义
│   ├── agent/             # 代理控制
│   │   └── AgentController.ts
│   ├── llm/               # LLM 集成
│   │   └── OpenAIClient.ts
│   ├── server/            # 服务器
│   │   └── index.ts
│   └── types/             # 共享类型
│       └── messages.ts
├── dist/                  # 编译输出
└── package.json
```

## 核心概念

### 游戏状态机 (GameEngine)

后端采用有限状态机 (FSM) 来控制游戏流程，主要状态包括：

```
NightStart → WolfAction → SeerAction → WitchAction →
PublishNightResult → CheckWinCondition → DayStart →
PlayerSpeak → PlayerVote → PublishVoteResult →
CheckWinCondition → GameOver
```

每个状态对应具体的游戏阶段，状态转换由 `GameEngine.handleState()` 方法处理。

### 游戏环境 (Environment)

`Environment` 类管理所有游戏状态：

- 玩家列表、身份、存活状态
- 发言历史、投票记录
- 夜晚行动结果（击杀、查验、毒药、解药）
- 可见性过滤器（根据玩家身份和存活状态过滤信息）

关键方法：

- `getVisiblePlayerInfo()` - 获取玩家可见的信息
- `markPlayerDead()` - 标记玩家死亡
- `getGameState()` - 获取完整游戏状态

### 角色系统 (Roles)

每个角色都有独立的实现，继承自 `BaseRole`：

- **Seer (预言家)**: 每晚查验一人身份
- **Witch (女巫)**: 拥有一瓶解药和一瓶毒药
- **Wolf (狼人)**: 每晚选择击杀目标
- **Villager (村民)**: 无特殊能力

每个角色实现：

- `beforeAction()` - 行动前准备
- `takeAction()` - 执行行动
- `afterAction()` - 行动后处理
- `getSystemPrompt()` - 获取角色专属系统提示词

### LLM 代理 (AgentController)

`AgentController` 负责：

- 为每个玩家创建独立的 LLM 代理
- 构建 LLM 提示词（系统提示 + 游戏历史）
- 解析 LLM 输出（支持 <think> 推理标签）
- 验证行动合法性

OODA 循环实现：

1. **Observe (观察)**: 收集可见的游戏信息
2. **Orient (定位)**: 分析局势、总结关键信息
3. **Decide (决策)**: 决定行动方案
4. **Act (行动)**: 生成具体的行动数据

### 行动验证 (ActionValidator)

严格验证所有玩家行动：

| 行动       | 验证规则                               |
| ---------- | -------------------------------------- |
| 狼人击杀   | 目标必须存活且不是狼人                 |
| 预言家查验 | 目标必须存活                           |
| 女巫用药   | 只能用一次解药、一次毒药，目标必须存活 |
| 投票       | 目标必须存活                           |

### LLM 集成 (OpenAIClient)

- 支持 OpenAI API 兼容端点
- 支持流式输出
- 自动提取 <think> 标签中的推理过程
- 可配置 API 密钥、模型、温度等参数

## 开发指南

### 安装依赖

```bash
cd backend
bun install
```

### 编译

```bash
bun run build
```

### 运行

```bash
bun start
```

默认地址：`http://localhost:3001`

### 配置

环境变量：

- `PORT`: 服务器端口（默认 3001）
- `OPENAI_API_KEY`: LLM API 密钥
- `OPENAI_BASE_URL`: API 基础 URL
- `OPENAI_MODEL`: 模型名称

## WebSocket API

### 事件列表

| 事件名            | 方向            | 说明         |
| ----------------- | --------------- | ------------ |
| `hostGame`        | Client → Server | 房主创建游戏 |
| `joinGame`        | Client → Server | 玩家加入游戏 |
| `gameStarted`     | Server → Client | 游戏开始     |
| `phaseChanged`    | Server → Client | 阶段变更     |
| `gameStateUpdate` | Server → Client | 游戏状态更新 |
| `playerAction`    | Client → Server | 玩家提交行动 |
| `actionReceived`  | Server → Client | 行动已接收   |
| `gameOver`        | Server → Client | 游戏结束     |

### 示例：创建游戏

```typescript
socket.emit("hostGame", {
  playerName: "房主",
  playerCount: 6,
  config: {
    enableWitch: true,
    enableSeer: true,
    enableSheriff: false,
  },
});
```

## 游戏记录

游戏过程会记录到 `backend/data/records/` 目录：

- `game-{timestamp}.jsonl`: JSONL 格式的完整游戏日志
- 包含所有状态转换、玩家行动、LLM 输出

## 测试

```bash
bun test
```

---

_相关文件（弃用）：`../configs.example/system-prompts/`（目录已移除）_
