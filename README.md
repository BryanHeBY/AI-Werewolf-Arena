# AI 狼人杀竞技场

观看多个 AI 模型玩狼人杀（黑手党）游戏，同时可以看到 AI 的内心独白！

## 目录

- [项目概述](#项目概述)
- [游戏规则](#游戏规则)
- [系统架构](#系统架构)
- [项目结构](#项目结构)
- [安装指南](#安装指南)
- [配置说明](#配置说明)
- [使用方法](#使用方法)
- [游戏流程](#游戏流程)
- [核心概念](#核心概念)
- [开发指南](#开发指南)
- [故障排查](#故障排查)
- [详细文档](#详细文档)

---

## 项目概述

AI 狼人杀竞技场是一个多人游戏引擎，让 AI 代理玩经典的社交推理游戏狼人杀（也称为黑手党）。主要特性包括：

- 🎭 **多 AI 模型**：每个玩家可以使用不同的 LLM（兼容 OpenAI API）
- 🧠 **内心独白**：实时观看 AI 的推理过程
- 🎮 **实时可视化**：实时游戏状态、玩家卡片和游戏日志
- 📊 **游戏记录**：保存完整的游戏历史供后续分析
- 🔌 **WebSocket 通信**：后端和前端之间的实时更新

---

## 游戏规则

### 角色与阵营

| 角色       | 阵营 | 描述                                       | 夜晚能力  |
| ---------- | ---- | ------------------------------------------ | --------- |
| **狼人**   | 狼人 | 每晚杀死一名玩家                           | 杀人      |
| **村民**   | 村民 | 无特殊能力                                 | 无        |
| **预言家** | 村民 | 每晚查验一名玩家的阵营                     | 查验      |
| **女巫**   | 村民 | 每局游戏一瓶解药（救人）和一瓶毒药（杀人） | 解药/毒药 |

### 胜利条件

- **村民胜利**：所有狼人死亡
- **狼人胜利**：狼人数量 ≥ 村民数量

### 游戏阶段（严格顺序）

1. **夜晚开始** - 重置夜晚状态
2. **狼人行动** - 狼人选择要杀的人
3. **预言家行动** - 预言家查验一名玩家
4. **女巫行动** - 女巫决定使用解药/毒药
5. **白天开始** - 过渡到白天
6. **公布夜晚结果** - 宣布谁死了
7. **检查胜利条件** - 有人获胜了吗？
8. **顺序发言** - 所有存活玩家按顺序发言
9. **投票** - 玩家投票放逐某人
10. **检查胜利条件** - 有人获胜了吗？
11. **游戏结束** - 宣布获胜者

---

## 系统架构

```
┌─────────────────┐         WebSocket          ┌─────────────────┐
│   前端          │ ◄─────────────────────────► │   后端          │
│  (Vue 3 + Vite) │                            │  (Fastify + TS) │
└─────────────────┘                            └─────────────────┘
         │                                              │
         │                                              │
         ▼                                              ▼
┌─────────────────┐                            ┌─────────────────┐
│  游戏 UI        │                            │  游戏引擎        │
│  - 玩家网格     │                            │  - 状态机        │
│  - 游戏日志     │                            │  - 角色逻辑      │
│  - 控制面板     │                            │  - LLM 集成      │
└─────────────────┘                            └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  OpenAI API     │
                                                │  (多 LLM 支持)  │
                                                └─────────────────┘
```

### 关键组件

#### 后端

- **GameEngine**：管理游戏流程的核心状态机
- **Environment**：游戏状态的单一数据源
- **Roles**：角色特定逻辑（狼人、村民、预言家、女巫）
- **AgentController**：管理所有玩家的 LLM 交互
- **Broadcaster**：WebSocket 事件广播
- **GameLogger**：将游戏记录保存到磁盘

#### 前端

- **App.vue**：主应用组件
- **PlayerGrid**：显示所有玩家及其状态
- **PlayerCard**：单个玩家信息卡片
- **GameLog**：实时游戏事件日志
- **TopBar**：游戏控制和状态

---

## 项目结构

```
ai-werewolf-arena/
├── backend/                      # 后端游戏引擎
│   ├── src/
│   │   ├── core/                # 核心游戏逻辑
│   │   │   ├── GameEngine.ts    # 主状态机
│   │   │   ├── Environment.ts   # 游戏状态容器
│   │   │   ├── types.ts         # 类型定义
│   │   │   ├── GameFactory.ts   # 游戏创建
│   │   │   └── EventBus.ts      # 事件系统
│   │   ├── roles/               # 角色实现
│   │   │   ├── Role.ts          # 基础角色接口
│   │   │   ├── WolfRole.ts
│   │   │   ├── VillagerRole.ts
│   │   │   ├── SeerRole.ts
│   │   │   └── WitchRole.ts
│   │   ├── agent/               # 代理/LLM 管理
│   │   │   ├── AgentController.ts
│   │   │   └── ActionValidator.ts
│   │   ├── llm/                 # LLM 集成
│   │   │   ├── OpenAIClient.ts
│   │   │   └── Retry.ts
│   │   ├── logger/              # 游戏日志
│   │   │   └── GameLogger.ts
│   │   ├── broadcaster/         # WebSocket 广播
│   │   │   └── Broadcaster.ts
│   │   ├── config/              # 配置
│   │   │   └── index.ts
│   │   ├── server/              # HTTP/WebSocket 服务器
│   │   │   ├── index.ts
│   │   │   └── socket.ts
│   │   └── run-test.ts          # 测试脚本
│   ├── data/
│   │   └── records/             # 保存的游戏记录 (.jsonl)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                     # 前端可视化
│   ├── src/
│   │   ├── components/
│   │   │   ├── App.vue          # 主应用
│   │   │   ├── TopBar.vue       # 控制栏
│   │   │   ├── PlayerGrid.vue   # 玩家显示
│   │   │   ├── PlayerCard.vue   # 单个玩家
│   │   │   ├── GameLog.vue      # 事件日志
│   │   │   ├── LogTerminal.vue  # 终端风格日志
│   │   │   └── ui/              # shadcn-vue 组件
│   │   └── main.ts
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── package.json                  # 根包（monorepo）
├── .gitignore
├── .env.example
└── README.md
```

---

## 安装指南

### 前置要求

- Node.js >= 18.0.0
- npm 或 yarn
- OpenAI API 密钥（或兼容的 API 端点）

### 步骤 1：克隆仓库

```bash
git clone <仓库地址>
cd ai-werewolf-arena
```

### 步骤 2：安装依赖

```bash
# 安装所有依赖（根目录 + 后端 + 前端）
npm run install:all

# 或者分别安装：
npm install
cd backend && npm install
cd ../frontend && npm install
```

---

## 配置说明

### 环境变量

将 `.env.example` 复制为 `.env` 并进行配置：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# 服务器配置
PORT=3344
CORS_ORIGIN=http://localhost:5173

# OpenAI 配置（所有玩家的默认配置）
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-你的实际-api-密钥
OPENAI_MODEL=gpt-4o
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=1024

# 游戏配置
GAME_RECORDS_DIR=./data/records
```

### 游戏配置

编辑 `backend/src/config/index.ts` 来更改游戏设置：

```typescript
export const DEFAULT_CONFIG: GameConfig = {
  totalPlayers: 6,
  wolfCount: 2,
  villagerCount: 2,
  seerCount: 1,
  witchCount: 1,
  modelDefaults: {
    // 来自环境变量
  },
};
```

---

## 使用方法

### 启动后端

```bash
cd backend
npm run dev
```

后端将在 `http://localhost:3344` 启动

### 启动前端

在新终端中：

```bash
cd frontend
npm run dev
```

前端将在 `http://localhost:5173` 启动

### 同时启动两者（便捷方式）

从根目录：

```bash
# 终端 1：后端
npm run dev:backend

# 终端 2：前端
npm run dev:frontend
```

### 玩游戏

1. 在浏览器中打开前端：`http://localhost:5173`
2. 点击「Start Mock」开始
3. 观看 AI 代理玩游戏！
4. 使用「Pause」/「Next Step」进行逐步执行
5. 点击「Reset」重新开始

---

## 游戏流程

### 完整阶段循环

```
┌─────────────────────────────────────────────────────────────────┐
│                        夜晚阶段                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. NightStart     → 重置 nightResult                           │
│  2. WolfAction     → 狼人投票杀人                                │
│  3. SeerAction     → 预言家查验某人                              │
│  4. WitchAction    → 女巫使用解药/毒药                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         白天阶段                                 │
├─────────────────────────────────────────────────────────────────┤
│  5. DayStart                                                    │
│  6. PublishNightResult → 宣布死亡，标记玩家死亡                  │
│  7. CheckWinCondition  → 有人获胜了吗？                         │
│     ├─ 是 → GameOver                                           │
│     └─ 否 → 继续                                                 │
│  8. SequentialSpeech → 所有存活玩家发言                         │
│  9. Vote             → 玩家投票放逐                              │
│ 10. CheckWinCondition  → 有人获胜了吗？                         │
│     ├─ 是 → GameOver                                           │
│     └─ 否 → 下一晚 (round += 1)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 夜晚结果计算

```typescript
// nightResult.deadPlayerIds 的计算方式：
deadPlayerIds = []
if killedByWolf 且 not savedByWitch:
  deadPlayerIds.push(killedByWolf)
if poisonedByWitch:
  deadPlayerIds.push(poisonedByWitch)
```

---

## 核心概念

### 1. OODA 循环

每个 AI 代理都遵循完整的 OODA 循环（观察-定位-决策-行动）：

```
Observe (观察) → Orient (定位) → Decide (决策) → Act (行动)
   ↓                  ↓                 ↓                ↓
收集可见信息        分析局势          决定方案          执行行动
```

在 `AgentController` 中实现：

- **Observe**: 调用 `getVisibleHistory()` 收集对玩家可见的游戏历史，过滤掉不可见信息（如其他玩家的身份、未使用的技能等）
- **Orient**: 要求 LLM 总结关键观察和当前局势分析
- **Decide**: 要求 LLM 根据角色目标决定具体行动方案
- **Act**: 要求 LLM 生成结构化的行动数据（JSON 格式）

### 2. 角色系统

每个角色都有独立的实现，继承自 `BaseRole`：

| 角色   | 文件              | 特殊能力           |
| ------ | ----------------- | ------------------ |
| 狼人   | `WolfRole.ts`     | 每晚选择击杀目标   |
| 预言家 | `SeerRole.ts`     | 每晚查验一人身份   |
| 女巫   | `WitchRole.ts`    | 一瓶解药、一瓶毒药 |
| 村民   | `VillagerRole.ts` | 无特殊能力         |

角色系统提示词存储在 `configs/system-prompts/` 目录。

### 3. 单一数据源

所有游戏状态都存储在 `Environment.gameState` 中：

- 永远不要直接修改状态 - 使用 `env.setGameState()`
- `markPlayerDead()` 专门用于标记玩家死亡，同时更新存活玩家列表
- `getVisiblePlayerInfo(viewerId)` 根据查看者身份过滤可见信息
- `getVisibleHistory(viewerId)` 过滤对查看者可见的历史记录

### 4. 行动验证

`ActionValidator` 严格验证所有玩家行动：

| 行动       | 验证规则                     |
| ---------- | ---------------------------- |
| 狼人击杀   | 目标必须存活且不是狼人       |
| 预言家查验 | 目标必须存活                 |
| 女巫解药   | 只能用一次，且当晚有狼人击杀 |
| 女巫毒药   | 只能用一次，目标必须存活     |
| 投票       | 目标必须存活                 |

### 5. LLM 输出解析

- 支持 `<think>` 标签提取 AI 的内心独白
- 解析结构化的 JSON 行动数据
- 自动重试（最多 3 次）直到解析成功或达到最大重试次数
- `OpenAIClient` 支持流式输出和普通调用

### 6. WebSocket 事件

前端和后端通过 Socket.IO 实时通信：

| 事件                | 方向          | 说明          |
| ------------------- | ------------- | ------------- |
| `hostGame`          | Client→Server | 房主创建游戏  |
| `joinGame`          | Client→Server | 玩家加入游戏  |
| `gameStarted`       | Server→Client | 游戏开始      |
| `phaseChanged`      | Server→Client | 阶段变更      |
| `gameStateUpdate`   | Server→Client | 游戏状态更新  |
| `playerAction`      | Client→Server | 玩家提交行动  |
| `actionReceived`    | Server→Client | 行动已接收    |
| `playerJoined/Left` | Server→Client | 玩家加入/离开 |
| `gameOver`          | Server→Client | 游戏结束      |

---

## 开发指南

### 生产环境构建

```bash
# 构建后端
npm run build:backend

# 构建前端
npm run build:frontend

# 启动生产后端
npm start
```

### 代码风格

- 启用 TypeScript 严格模式
- 不使用 `any` 类型（改用 `unknown`）
- 遵循代码库中的现有模式
- 不使用中文注释（仅使用英文）

### 运行测试

```bash
cd frontend
npm run test          # 无头测试
npm run test:ui       # UI 模式
```

### 游戏记录

游戏记录以 `.jsonl` 文件形式保存在 `backend/data/records/` 中：

- 每行一个 JSON 对象
- 完整的游戏历史
- 可以重放或稍后分析

---

## 故障排查

### 常见问题

#### 1. 后端无法启动

- 检查端口 3344 是否被占用：`lsof -ti :3344`
- 验证 `.env` 文件存在且具有有效的 API 密钥
- 检查 Node.js 版本：`node --version`（需要 >= 18）

#### 2. 前端无法连接到后端

- 验证后端在端口 3344 上运行
- 检查 `.env` 中的 `CORS_ORIGIN` 是否与前端 URL 匹配
- 检查浏览器控制台是否有 WebSocket 错误

#### 3. AI 代理不行动

- 验证 API 密钥有效且有足够的额度
- 检查后端日志中的 LLM API 错误
- 验证模型名称正确（例如，`gpt-4o` 不是 `gpt4o`）

#### 4. 所有狼人死亡后游戏继续

- 确保 `PublishNightResult` 后面跟着 `CheckWinCondition`
- 验证 `checkWinCondition()` 正确实现
- 检查 `processPhase()` 正确处理 `CheckWinCondition`

#### 5. 不该是平安夜时却是平安夜

- 验证 `processWolfAction` 使用 `historyBefore` 仅获取当前夜晚的行动
- 确保 `nightResult` 通过 `env.setGameState()` 保存
- 检查 `processPublishNightResult` 调用 `env.markPlayerDead()`

### 调试模式

在以下位置添加 `console.log()` 语句：

- `GameEngine.processPhase()` - 跟踪阶段转换
- `AgentController.runAgentCycle()` - 查看 LLM 输入/输出
- `Environment.setGameState()` - 跟踪状态变化

### 日志

- 后端日志：`npm run dev:backend` 的控制台输出
- 游戏记录：`backend/data/records/*.jsonl`
- 前端日志：浏览器 DevTools 控制台

---

## 详细文档

- [后端 README](./backend/README.md) - 游戏引擎架构、角色系统、LLM 集成、API 文档
- [前端 README](./frontend/README.md) - UI 组件、状态管理、WebSocket 处理、开发指南

---

## 许可证

MIT

---

## 贡献指南

遵循现有代码模式并：

1. 保持提交小而专注
2. 不使用 `any` 类型或 `@ts-ignore`
3. 提交前测试更改
4. 如需要，更新文档
