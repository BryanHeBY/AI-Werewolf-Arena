# API 参考（V3）

## 1. 范围

本文档描述后端当前已实现的 HTTP 接口，以及下一步计划落地的 Session REST v1 设计。

- 当前实现入口：`backend/src/server/index.ts`
- 会话管理：`backend/src/server/v3_session_manager.ts`
- 实时事件：`backend/src/server/socket.ts`

## 2. 当前已实现接口（Current）

### `GET /api/status`

用途：
- 查询服务状态、引擎模式、当前会话摘要。

### `GET /api/start-game`
### `POST /api/start-game`

用途：
- 启动会话（GET 使用 query，POST 使用 body）。

参数：
- `game?: string`（推荐，映射到 `configs/games/<game>.json`）
- `maxDays?: number`

说明：
- 历史“板子类参数”属于兼容模式，后续以 `game` 为主。

### `POST /api/stop-game`

用途：
- 停止当前会话。

### `GET /api/session`

用途：
- 查询当前会话状态与公开游戏状态。

## 3. 目标接口（Target: Session REST v1）

目标：
- 统一以 `sessions` 资源建模；
- 保留旧接口兼容一段时间，但新前端与脚本优先使用 v1。

建议接口：

1. `POST /api/v1/sessions`
   - 创建或复用当前运行中的会话。
2. `GET /api/v1/sessions`
   - 列表查询（当前实现为单活跃会话，可返回 0 或 1 条）。
3. `GET /api/v1/sessions/current`
   - 查询当前会话详情（状态 + 公开态）。
4. `GET /api/v1/sessions/:sessionId`
   - 查询指定会话详情。
5. `GET /api/v1/sessions/:sessionId/result`
   - 查询终局结果（`gameOver/winner/reason`）。
6. `POST /api/v1/sessions/:sessionId/stop`
   - 停止指定会话。

v1 建议入参（创建会话）：

```json
{
  "game": "six_qwen",
  "maxDays": 10
}
```

详细字段规范见：
- `docs/apis/session_rest_api_v1_spec.md`
- `docs/apis/session_timeline_api_v1_spec.md`

## 4. 迁移策略

1. 新增 v1 路由，同时保留旧路由。
2. 前端和脚本迁移到 `/api/v1/sessions*`。
3. 观察一个版本周期后，标记旧路由为 deprecated。
