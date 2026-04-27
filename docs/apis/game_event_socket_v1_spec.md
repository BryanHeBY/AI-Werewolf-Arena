# Game Event Socket API v1 规范

## 1. 目标

定义前端正式消费 V3 实时广播时的统一 Socket 协议，范围包括：

1. 连接与注册
2. `gameEvent` 统一事件信封
3. 前端必须处理的事件类型与状态语义
4. 可见性边界与 `publicState` 刷新规则

说明：
1. 本文档只定义实时推送协议。
2. 会话生命周期仍以 `session_rest_api_v1_spec.md` 为准。
3. 复盘查询仍以 `session_timeline_api_v1_spec.md` 为准。
4. 本文档定义的是前后端契约，不要求后端领域事件名称与 `gameEvent.type` 一一同名。

## 2. 设计原则

1. V3 实时协议统一使用单事件通道：`gameEvent`。
2. 前端不再要求后端额外提供 `gameStateUpdate`、`chatMessage`、`submitAction`、`requestFullState` 等 V2 专用事件。
3. 前端通过增强后的 `gameEvent` 信封消费实时数据，而不是依赖零散字段自行推断主状态。
4. 所有“会改变前端公开主状态”的事件必须携带 `publicState`。
5. `gameEvent.type` 必须足够细粒度，能让前端在不猜测领域语义的情况下完成日志、动画与状态归档。
6. 可见性边界由后端决定；前端只渲染“当前已收到”的事件，不自行推断未收到的私有信息。

## 3. 连接模型

### 3.1 连接

前端通过 Socket.IO 连接后端服务：

- 默认地址：`http://localhost:3344`

### 3.2 注册

连接建立后，允许发送：

```json
{
  "event": "register",
  "data": {
    "playerId": 3,
    "role": "seer",
    "camp": "good"
  }
}
```

约定：
1. `playerId` 用于建立玩家与 socket 的映射。
2. `role` / `camp` 为可选提示字段，后端可据此完成更精确的私有事件投递。
3. 旁观/上帝视角前端可以不发送 `register`，只消费公开广播。

## 4. 实时事件结构

服务端统一通过 `gameEvent` 下发增强事件信封：

```json
{
  "id": "evt-000123",
  "seq": 123,
  "schemaVersion": 1,
  "sessionId": "v3-1",
  "category": "player_state",
  "type": "player.died",
  "day": 2,
  "phase": "Last_Words",
  "phaseId": "day-2:last-words",
  "stage": "resolved",
  "actorId": 5,
  "targetIds": [5],
  "timestamp": 1776011101942,
  "data": {
    "playerId": 5,
    "cause": "vote_out"
  },
  "publicState": {
    "phase": "Last_Words",
    "day": 2,
    "players": []
  },
  "visibility": {
    "scope": "public"
  }
}
```

### 4.1 顶层字段

1. `id: string`
   - 单事件唯一 ID，用于去重、时间线定位与调试。
2. `seq: number`
   - 当前 `sessionId` 内严格递增的序号。
3. `schemaVersion: number`
   - 当前协议版本号，v1 固定为 `1`。
4. `sessionId: string`
   - 事件所属会话 ID。
5. `category: string`
   - 事件大类，供前端做一级分发或日志过滤。
6. `type: string`
   - 细粒度事件类型，必须稳定、可枚举、可测试。
7. `day: number`
   - 当前第几天，从 1 开始。
8. `phase: string`
   - 当前阶段枚举，值域与前端公开态保持一致。
9. `phaseId?: string`
   - 阶段实例 ID，用于标识同一天内的具体阶段切片。
10. `stage?: string`
   - 事件在流程中的位置，例如 `started`、`progress`、`resolved`、`completed`。
11. `actorId?: number | null`
   - 动作发起者。
12. `targetIds?: number[]`
   - 动作目标列表。
13. `timestamp: number`
   - 事件生成时间戳（毫秒）。
14. `data: object`
   - 该 `type` 对应的结构化负载。
15. `publicState?: object`
   - 当前事件对应的“最新公开状态快照”。
16. `visibility?: { scope }`
   - 事件可见性说明。

### 4.2 `category` 建议值

1. `session`
2. `phase`
3. `agent`
4. `player_action`
5. `player_state`
6. `vote`
7. `night`
8. `system`
9. `result`

### 4.3 `visibility`

可见性：
1. `public`
2. `wolves_only`
3. `private_targets`

说明：
1. 前端一般不依赖 `visibility` 自行做权限裁剪；收到即表示当前连接有权看到该事件。
2. `visibility` 主要用于调试、回放语义对齐与协议说明。

## 5. `publicState` 规则

### 5.1 强制要求

以下事件必须携带 `publicState`：

1. `session.game_started`
2. `phase.changed`
3. `player.died`
4. `night.resolved`
5. `vote.resolved`
6. `game.over`
7. 任何会改变前端公开可见主状态的新增事件

### 5.2 语义要求

1. `publicState` 是“事件处理完成后的最新公开状态”，不是旧状态。
2. 前端在收到带 `publicState` 的事件时，必须优先用它刷新主状态。
3. 前端不得继续依赖 `playerId`、`deadPlayerIds`、`winner` 等局部字段自行补丁核心公开状态。
4. `publicState` 中至少应覆盖：
   - 当前天数
   - 当前阶段
   - 玩家公开存活状态
   - 公开身份翻牌结果（若有）
   - 当前公开投票权/警徽/终局结果等

## 6. 事件类型命名规则

### 6.1 命名格式

统一采用点分命名空间：

1. `session.*`
2. `phase.*`
3. `agent.*`
4. `player.action.*`
5. `player.*`
6. `vote.*`
7. `night.*`
8. `game.*`
9. `winner.*`

### 6.2 必须优先支持的类型

1. `session.game_started`
2. `phase.changed`
3. `agent.thinking`
4. `agent.thought_complete`
5. `player.action.speak`
6. `player.action.vote`
7. `player.action.kill`
8. `player.action.guard`
9. `player.action.check`
10. `player.action.heal`
11. `player.action.poison`
12. `player.died`
13. `night.resolved`
14. `vote.resolved`
15. `game.over`
16. `winner.declared`

说明：
1. 前端日志、动画和高亮应主要基于 `type` + `data`。
2. 玩家生死、阶段、终局、公开投票权等主状态应主要基于 `publicState`。

## 7. 事件类型示例

### 7.1 `session.game_started`

用途：
1. 初始化页面可渲染状态。
2. 建立首帧玩家列表、回合数与公开游戏态。

示例：

```json
{
  "category": "session",
  "type": "session.game_started",
  "day": 1,
  "phase": "Night_Start",
  "data": {
    "players": []
  },
  "publicState": {
    "phase": "Night_Start",
    "day": 1,
    "players": []
  }
}
```

### 7.2 `phase.changed`

用途：
1. 阶段切换通知。
2. 作为公开状态刷新点。

示例：

```json
{
  "category": "phase",
  "type": "phase.changed",
  "day": 1,
  "phase": "Sequential_Speech",
  "stage": "started",
  "data": {
    "fromPhase": "Night_Result",
    "toPhase": "Sequential_Speech"
  },
  "publicState": {
    "phase": "Sequential_Speech",
    "day": 1,
    "players": []
  }
}
```

### 7.3 `agent.thinking`

用途：
1. 渲染“思考中”提示。
2. 在允许的视角中显示思考文本或阶段提示。

示例：

```json
{
  "category": "agent",
  "type": "agent.thinking",
  "actorId": 3,
  "data": {
    "thought": "...",
    "reason": "night_action"
  }
}
```

### 7.4 `player.action.speak`

用途：
1. 追加发言日志。
2. 高亮当前发言玩家。

示例：

```json
{
  "category": "player_action",
  "type": "player.action.speak",
  "actorId": 4,
  "targetIds": [],
  "data": {
    "content": "我先过。",
    "speechOrder": 2
  }
}
```

### 7.5 `player.died`

用途：
1. 明确广播玩家死亡。
2. 让前端直接拿到死亡后的最新公开状态。

示例：

```json
{
  "category": "player_state",
  "type": "player.died",
  "actorId": 7,
  "targetIds": [7],
  "stage": "resolved",
  "data": {
    "playerId": 7,
    "cause": "night_kill",
    "revealedRole": null
  },
  "publicState": {
    "phase": "Night_Result",
    "day": 2,
    "players": []
  }
}
```

### 7.6 `night.resolved`

用途：
1. 公布昨夜结算结果。
2. 提供死者列表与结算后的公开状态。

示例：

```json
{
  "category": "night",
  "type": "night.resolved",
  "stage": "resolved",
  "data": {
    "deadPlayerIds": [2],
    "peacefulNight": false
  },
  "publicState": {
    "phase": "Night_Result",
    "day": 2,
    "players": []
  }
}
```

### 7.7 `vote.resolved`

用途：
1. 展示放逐结果。
2. 刷新放逐后的公开状态。

示例：

```json
{
  "category": "vote",
  "type": "vote.resolved",
  "stage": "resolved",
  "actorId": null,
  "targetIds": [5],
  "data": {
    "eliminatedPlayerId": 5,
    "voteSummary": []
  },
  "publicState": {
    "phase": "Last_Words",
    "day": 2,
    "players": []
  }
}
```

### 7.8 `game.over`

用途：
1. 标记终局。
2. 写入胜负结果与最终公开态。

示例：

```json
{
  "category": "result",
  "type": "game.over",
  "stage": "completed",
  "data": {
    "winner": "wolf",
    "reason": "wolves_reached_majority"
  },
  "publicState": {
    "phase": "Game_Over",
    "day": 3,
    "players": [],
    "gameOver": true
  }
}
```

## 8. 前端状态模型要求

前端正式接入 V3 时，运行态至少维护：

1. `connection`
2. `session`
3. `public game state`
4. `players`
5. `timeline / log`
6. `thinking players`
7. `winner / gameOver`

要求：
1. 带 `publicState` 的事件优先作为“公开主状态刷新点”。
2. 不带 `publicState` 的事件只作为“增量 UI 事件”。
3. 不得要求后端提供第二套与 `gameEvent` 重复的专用前端状态流。

## 9. 与 V2 前端协议的关系

V2 前端中以下事件/调用不再作为 V3 正式协议的一部分：

1. `gameStateUpdate`
2. `chatMessage`
3. `submitAction`
4. `requestFullState`
5. 业务层 `ping/pong`

迁移要求：
1. 前端保留兼容 mock 时可继续本地使用旧结构。
2. 真实后端联调时统一走增强版 `gameEvent`。

## 10. 与 REST API 的边界

1. `POST /api/v1/sessions`：创建会话
2. `GET /api/v1/sessions/current`：获取当前会话与公开状态
3. `GET /api/v1/sessions/:sessionId/result`：获取终局结果
4. `GET /api/v1/sessions/:sessionId/timeline`：获取复盘时间线

推荐前端启动顺序：
1. 调用 `POST /api/v1/sessions`
2. 建立 Socket 连接
3. 监听 `gameEvent`
4. 断线恢复时，可调用 `GET /api/v1/sessions/current` 做状态重建

## 11. 验收标准

1. 前端连接 V3 后端后，仅依赖增强版 `gameEvent` 即可完成实时 UI 更新。
2. 前端不再要求后端提供 V2 风格的专用 Socket 事件。
3. 所有会改变公开状态的事件都能提供 `publicState`。
4. 断线重连后，前端能通过 REST 当前态接口恢复公开状态。
5. 私有信息不通过前端自行推断，只消费后端显式投递的事件。
