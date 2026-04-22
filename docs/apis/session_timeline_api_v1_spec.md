# Session Timeline API v1 规范

## 1. 目标

为“整局复盘展示”提供稳定 API：

1. 整局公共时间线
2. 严格阶段窗口（phase/stage）
3. 玩家视角时间线
4. 阶段切片查询

## 2. 数据来源

记录目录：`backend/data/records/<session_id>/`

必需文件：

1. `manifest.json`
2. `public_timeline.json`
3. `players/player_<id>.json`

新增文件（已实现）：

1. `phase_windows.json`
2. `timeline_index.json`

## 3. 新增记录结构

### 3.1 phase_windows.json

```json
{
  "session_id": "session_xxx",
  "windows": [
    {
      "phase_id": "d1-night",
      "day": 1,
      "phase": "night",
      "start_seq": 1,
      "end_seq": 42,
      "stages": [
        {"stage": "wolf_discussion", "start_seq": 3, "end_seq": 12}
      ]
    }
  ]
}
```

约束：

1. `start_seq <= end_seq`
2. `windows` 按 `start_seq` 严格递增
3. `phase_id` 全局唯一

### 3.2 timeline_index.json

```json
{
  "session_id": "session_xxx",
  "public": {
    "min_seq": 1,
    "max_seq": 420,
    "count": 420
  },
  "players": {
    "1": {"count": 120},
    "2": {"count": 118}
  },
  "phases": {
    "count": 9
  }
}
```

## 4. API 定义

### 4.1 获取整局公共 timeline

- `GET /api/v1/sessions/:sessionId/timeline`

Query：

1. `fromSeq?: number`
2. `toSeq?: number`
3. `phaseId?: string`

响应：

```json
{
  "success": true,
  "data": {
    "sessionId": "session_xxx",
    "events": [],
    "page": {"fromSeq": 1, "toSeq": 100, "hasMore": true}
  }
}
```

### 4.2 获取阶段窗口

- `GET /api/v1/sessions/:sessionId/phases`

响应：

```json
{
  "success": true,
  "data": {
    "sessionId": "session_xxx",
    "windows": []
  }
}
```

### 4.3 获取玩家视角 timeline

- `GET /api/v1/sessions/:sessionId/players/:playerId/timeline`

Query：

1. `phaseId?: string`
2. `kind?: "broadcast" | "turn"`

响应：

```json
{
  "success": true,
  "data": {
    "sessionId": "session_xxx",
    "playerId": 3,
    "timeline": []
  }
}
```

### 4.4 获取会话结果（复盘页快捷接口）

- `GET /api/v1/sessions/:sessionId/result`

响应：

```json
{
  "success": true,
  "data": {
    "sessionId": "session_xxx",
    "gameOver": true,
    "result": {"winner": "wolf", "reason": "wolves_reach_half"}
  }
}
```

## 5. 错误码

1. `404`：session 或 player 不存在
2. `422`：`fromSeq > toSeq` 等参数错误
3. `503`：记录服务不可用

## 6. 与现有 Session REST v1 的关系

1. `session_rest_api_v1_spec.md` 负责会话生命周期
2. 本文负责复盘查询能力
3. 两者共用 `sessionId`

## 7. 验收标准

1. 可按 `sessionId` 获取完整公共时间线
2. 可按 `phaseId` 获取严格阶段切片
3. 可按玩家获取其 timeline，且顺序与 `player_x.json` 一致
4. `phase_windows` 与 `public_timeline.events` 的 `seq` 对齐无空洞
