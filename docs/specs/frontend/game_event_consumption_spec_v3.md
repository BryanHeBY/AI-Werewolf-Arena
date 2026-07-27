# Frontend Game Event Consumption Spec (V3)

开发驱动：`docs/drivers/frontend/game_event_consumption_driver_v3.md`

> 状态：未来在线观战规范。当前已移除 Vue/Socket 实现，前端仅提供离线 React 复盘播放器；下文的 `App.vue` 表述是历史方案，不是现行代码结构。

## 1. 目标

将当前前端从“V2 mock/chatflow 主导”迁移为“正式消费增强版 V3 `gameEvent` 协议”的实现。

本规范约束：
1. 前端状态分层
2. 增强事件信封消费模型
3. 组件责任边界
4. 与 V3 后端 REST / Socket 的对齐方式

## 2. 当前问题定义

当前前端存在两套并行模型：

1. `composables/useGameStore.ts`
   - 已能消费 `gameEvent`
   - 更接近 V3 后端实时广播结构
2. `stores/gameStore.ts` + `network/socket.ts`
   - 仍依赖 V2 风格事件：`gameStateUpdate`、`chatMessage`
   - 更偏 mock / 本地视角切换实验

同时，当前 V3 `gameEvent` 还存在协议表达力不足的问题：

1. 事件 `type` 过粗，前端无法稳定区分发言、投票、杀人、守护等动作。
2. 状态变更事件没有稳定附带最新公开状态，前端只能本地猜测玩家存活、阶段或终局结果。
3. 旧文档默认将 `data.gameState` 作为少数事件的补充字段，这不足以支撑正式联调与长期演进。

因此需要明确：
1. V3 正式联机路径只能保留一套主协议；
2. 该主协议必须是增强版 `gameEvent`；
3. 前端不得继续通过局部 delta 猜测核心公开状态；
4. V2 mock 能力属于开发辅助，不得继续定义真实后端契约。

## 3. 总体约束

### 3.1 协议约束

1. 前端正式联机只消费 `gameEvent`
2. 前端消费的 `gameEvent` 必须符合 `docs/apis/game_event_socket_v1_spec.md`
3. 前端不得要求后端提供第二套“前端专用状态流”
4. 前端状态恢复统一通过 REST 当前态接口补齐，而不是 `requestFullState`

### 3.2 状态约束

前端主 store 需要拆分为：

1. `session state`
2. `public game state`
3. `ui event log`
4. `transient ui state`

其中：
1. `session state`：来自 `/api/v1/sessions*`
2. `public game state`：来自带 `publicState` 的 `gameEvent`
3. `ui event log`：来自 `type + category + data`
4. `transient ui state`：例如 loading、active speaker、thinking ids、socket 状态

### 3.3 组件约束

1. `App.vue` 负责页面布局与顶层装配，不直接承载协议转换逻辑
2. Socket 事件解析集中在 store/composable 层
3. 展示组件只消费归一化后的前端状态，不直接理解后端原始事件
4. 玩家卡片、状态栏、时间线必须从统一的 `public game state` 读取玩家存活、回合、阶段与胜负

## 4. 推荐前端结构

建议以 V3 正式联机路径为中心，建立以下结构：

```text
frontend/src/
├── stores/
│   └── v3GameStore.ts         # 正式 V3 store
├── network/
│   └── v3GameSocket.ts        # 只处理 gameEvent/register/connect/disconnect
├── mappers/
│   └── gameEventMapper.ts     # 将 RealtimeGameEvent 映射为前端状态更新
├── composables/
│   └── useV3Session.ts        # REST + socket 协调
└── components/
    └── ...                    # 只消费归一化状态
```

说明：
1. 现有 V2 `gameStore.ts` / `socket.ts` 可保留做 mock 辅助，但不得继续作为正式联机主入口。
2. 现有 `useGameStore.ts` 中已验证可消费的 `gameEvent` 逻辑，应优先吸纳为正式实现基础。

## 5. 增强事件信封消费要求

### 5.1 前端必须识别的顶层字段

前端正式实现至少要识别：

1. `id`
2. `seq`
3. `sessionId`
4. `category`
5. `type`
6. `day`
7. `phase`
8. `stage`
9. `actorId`
10. `targetIds`
11. `timestamp`
12. `data`
13. `publicState`
14. `visibility`

要求：
1. `id + seq` 用于去重和重放保护。
2. `type` 用于细粒度 UI 分发。
3. `publicState` 用于主状态刷新。
4. `category` 可用于时间线分组或过滤，但不得替代 `type`。

### 5.2 主状态刷新规则

以下事件必须被视为主状态刷新点：

1. `session.game_started`
2. `phase.changed`
3. `player.died`
4. `night.resolved`
5. `vote.resolved`
6. `game.over`

要求：
1. 前端在收到这些事件时，必须优先使用 `publicState` 覆盖 `public game state`。
2. 前端不得继续通过 `playerId`、`deadPlayerIds`、`winner`、`phase` 等零散字段手工 patch 主状态。
3. 如果某个状态变更事件缺失 `publicState`，应视为协议不完整，至少记录错误日志并在联调环境中暴露出来。

### 5.3 增量 UI 事件

以下事件主要更新“日志 / 气泡 / 临时效果”：

1. `agent.thinking`
2. `agent.thought_complete`
3. `player.action.speak`
4. `player.action.vote`
5. `player.action.kill`
6. `player.action.guard`
7. `player.action.check`
8. `player.action.heal`
9. `player.action.poison`
10. `winner.declared`

要求：
1. 允许保留本地派生日志文案。
2. 但玩家存活、赢家、阶段等主状态仍由 `publicState` 控制。
3. `actorId` / `targetIds` 应可直接驱动高亮、箭头、头像标记等 UI 动效。

## 6. 前端状态模型要求

### 6.1 Store 分层

建议 store 明确拆分：

1. `session`
2. `publicState`
3. `timeline`
4. `transient`

建议语义：
1. `session`：当前 `sessionId`、连接模式、REST 状态、重连信息
2. `publicState`：唯一可信的公开游戏态
3. `timeline`：按 `seq` 追加的结构化事件流
4. `transient`：正在思考玩家、当前高亮玩家、请求中的按钮状态

### 6.2 玩家状态来源

玩家卡片上的以下信息必须来自 `publicState.players` 或其映射结果：

1. 存活 / 死亡
2. 是否已翻牌
3. 是否持有警徽
4. 公开投票权状态
5. 终局是否显示真实身份

禁止：
1. 仅凭 `player.died.data.playerId` 直接把本地玩家状态写死为死亡
2. 仅凭 `winner.declared.data.message` 推断真实胜者
3. 仅凭 `phase.changed.data.toPhase` 推断完整阶段副作用

## 7. 组件对齐要求

### 7.1 页面主线

目标不是继续扩展 V2 专用协议，而是：

1. 保留 V2 chatflow 的 UI 体验与组件资产
2. 将前端正式联机路径统一切到增强版 V3 `gameEvent`
3. 会话创建/停止/恢复统一走 `/api/v1/sessions*`

### 7.2 组件消费方式

1. `ChatFlow`、玩家面板、阶段栏、日志流都只能消费 store 已归一化的数据
2. 原始 socket 事件不得直接在组件中分支解析
3. UI 如果需要“某类动作动画”，应通过 `type`、`actorId`、`targetIds`、`stage` 驱动

## 8. V2 Mock 保留策略

允许保留：
1. `mockDataEngine.ts`
2. `mocks/engine.ts`
3. V2 视角切换实验 UI

但要求：
1. mock 入口与正式联机入口必须显式分离
2. 不得让 mock 协议污染正式后端契约
3. Playwright 至少保留一组“真实协议 smoke test”和一组“mock smoke test”

## 9. REST 对齐要求

前端正式接入时必须优先使用：

1. `POST /api/v1/sessions`
2. `GET /api/v1/sessions/current`
3. `POST /api/v1/sessions/:sessionId/stop`
4. `GET /api/v1/sessions/:sessionId/result`

要求：
1. 新前端不再以 `/api/start-game` 为主入口
2. 旧接口只保留调试/兼容用途

## 10. Socket 对齐要求

正式联机允许的客户端事件：
1. `register`

正式联机必须处理的服务端事件：
1. `gameEvent`

正式联机必须适配的核心类型：
1. `session.game_started`
2. `phase.changed`
3. `agent.thinking`
4. `agent.thought_complete`
5. `player.action.speak`
6. `player.action.vote`
7. `player.died`
8. `night.resolved`
9. `vote.resolved`
10. `game.over`
11. `winner.declared`

禁止继续作为正式契约的事件：
1. `gameStateUpdate`
2. `chatMessage`
3. `submitAction`
4. `requestFullState`

## 11. 迁移阶段

### 11.1 第一阶段：文档与协议升级

1. 明确增强版 `gameEvent` 为唯一正式实时协议
2. 补齐前后端规范/驱动/handbook

### 11.2 第二阶段：实现 V3 主 store

1. 建立正式 V3 store
2. 把 `useGameStore.ts` 中的 `gameEvent` 处理逻辑迁入主 store
3. 将 `App.vue` 改为消费 V3 主 store

### 11.3 第三阶段：压缩 V2 兼容层

1. 将 V2 `socket.ts` 明确标记为 mock-only
2. 清理真实联机路径中的 V2 协议假设

### 11.4 第四阶段：联调与回归

1. 前端通过 `/api/v1/sessions* + gameEvent` 可完整跑通
2. Playwright 增加真实 V3 联调 smoke test

## 12. 验收标准

1. 前端启动真实联机模式时，不依赖任何 V2 Socket 事件
2. 前端可通过 `POST /api/v1/sessions` + 增强版 `gameEvent` 完成实时展示
3. 玩家生死、阶段、警徽、终局等公开状态来自 `publicState`，不是前端猜测
4. 断线后可通过 `GET /api/v1/sessions/current` 恢复公开状态
5. mock 模式仍可独立运行，但与正式联机路径清晰分离
