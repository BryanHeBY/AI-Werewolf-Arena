# Session REST API v1 规范

## 1. 目标

统一后端会话生命周期 API，支持当前已实现能力并为复盘 API 提供稳定入口：

1. 启动会话
2. 查询会话列表/当前会话/指定会话
3. 停止会话
4. 查询终局结果

说明：
1. 本文只定义生命周期与会话状态。
2. timeline/phase/player-view 查询能力由 `session_timeline_api_v1_spec.md` 定义。

## 2. 参数模型（game-first）

创建会话统一使用 `game` 参数：

```json
{
  "game": "six_qwen",
  "maxDays": 10
}
```

约定：
1. `game` 映射 `configs/games/<game>.json`。
2. `maxDays` 为可选运行时覆盖值。
3. 不再把 `board` / `boardConfigName` 作为 v1 主参数暴露。

## 3. 资源模型

### 3.1 Session

```json
{
  "id": "session_1776011101942_kfvqno",
  "game": "twelve_minimax",
  "running": true,
  "snapshot": {
    "day": 1,
    "phase": "day",
    "gameOver": false,
    "winner": null,
    "reason": null
  },
  "record": {
    "ready": true,
    "recordDir": "backend/data/records/session_1776011101942_kfvqno"
  }
}
```

### 3.2 SessionResult

```json
{
  "sessionId": "session_1776011101942_kfvqno",
  "gameOver": true,
  "result": {
    "winner": "wolf",
    "reason": "wolves_reach_half"
  }
}
```

## 4. 接口定义

### 4.1 创建会话

- `POST /api/v1/sessions`

请求体：

```json
{
  "game": "six_qwen",
  "maxDays": 10
}
```

响应：

```json
{
  "success": true,
  "data": {
    "session": {},
    "gameState": {}
  }
}
```

### 4.2 查询会话列表

- `GET /api/v1/sessions`

响应：

```json
{
  "success": true,
  "data": [
    {
      "session": {},
      "gameState": {}
    }
  ]
}
```

说明：
1. 当前引擎是单活跃会话模型，列表长度为 0 或 1。
2. 接口保留多会话扩展形态。

### 4.3 查询当前会话

- `GET /api/v1/sessions/current`

响应结构同 4.2 的单条对象。

### 4.4 查询指定会话

- `GET /api/v1/sessions/:sessionId`

响应结构同 4.3。

### 4.5 查询终局结果

- `GET /api/v1/sessions/:sessionId/result`

响应：

```json
{
  "success": true,
  "data": {
    "sessionId": "session_1776011101942_kfvqno",
    "gameOver": true,
    "result": {
      "winner": "wolf",
      "reason": "wolves_reach_half"
    }
  }
}
```

### 4.6 停止会话

- `POST /api/v1/sessions/:sessionId/stop`

响应：

```json
{
  "success": true,
  "data": {
    "session": {},
    "gameState": {}
  }
}
```

## 5. 错误语义

统一错误响应：

```json
{
  "success": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "session not found"
  }
}
```

状态码约定：
1. `400`：参数非法
2. `404`：会话不存在
3. `409`：资源冲突（如已存在运行中会话且策略为拒绝新建）
4. `503`：引擎不可用（例如 `V3_ENGINE_ENABLED=false`）

## 6. 与 Timeline API 的边界

1. lifecycle（本文）：开局/停局/状态/结果。
2. replay（timeline spec）：整局时间线、阶段切片、玩家视角。
3. 两者共享 `sessionId`，前端复盘页通常先调：
   1. `GET /api/v1/sessions/:sessionId/result`
   2. `GET /api/v1/sessions/:sessionId/phases`
   3. `GET /api/v1/sessions/:sessionId/timeline`

## 7. 迁移与兼容

兼容保留旧接口：
1. `GET|POST /api/start-game`
2. `POST /api/stop-game`
3. `GET /api/session`

迁移顺序：
1. 新功能全部走 `/api/v1/sessions*`。
2. 旧调用逐步替换。
3. 完成替换后再统一下线旧接口。
