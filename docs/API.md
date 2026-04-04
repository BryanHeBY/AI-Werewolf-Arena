# AI-Werewolf-Arena V2 前后端通信与视角隔离契约

本文档是前端 Agent 2 开发的唯一真理。

---

## 1. 全局状态 (gameStateUpdate)

### 1.1 视角隔离规则

`roleType` 和 `faction` 只有在以下情况才能下发：

- `viewId === 0` (上帝视角)
- `viewId === player.id` (玩家自己的视角)
- `viewId` 与目标同属存活狼人时

否则必须设为 `undefined`。

### 1.2 数据结构

```typescript
interface GameStateUpdate {
  phase: GamePhase;
  round: number;
  players: PlayerInfo[];
  deadPlayerIds: number[];
  history: ChatMessage[];
  nightResult?: NightResult;
  votedDeadId?: number;
  winner?: Faction;
  witchHasAntidote: boolean;
  witchHasPoison: boolean;
  currentSpeechIndex: number;
  // Phase Stack 新增
  phaseStack: StackNode[];
}

interface PlayerInfo {
  id: number;
  name: string;
  roleType?: RoleType; // 视角隔离
  faction?: Faction; // 视角隔离
  isAlive: boolean;
  isSheriff?: boolean;
}

interface StackNode {
  phase: GamePhase;
  context?: Record<string, any>;
}
```

### 1.3 视角隔离示例

**示例 1：上帝视角 (viewId === 0)**

```json
{
  "players": [
    {
      "id": 1,
      "name": "Player 1",
      "roleType": "wolf",
      "faction": "wolf",
      "isAlive": true
    }
  ]
}
```

**示例 2：玩家 1 视角 (viewId === 1)**

```json
{
  "players": [
    {
      "id": 1,
      "name": "Player 1",
      "roleType": "wolf",
      "faction": "wolf",
      "isAlive": true
    },
    {
      "id": 2,
      "name": "Player 2",
      "roleType": undefined,
      "faction": undefined,
      "isAlive": true
    }
  ]
}
```

**示例 3：存活狼人玩家 1 视角 (viewId === 1，且 Player 3 也是存活狼人)**

```json
{
  "players": [
    {
      "id": 1,
      "name": "Player 1",
      "roleType": "wolf",
      "faction": "wolf",
      "isAlive": true
    },
    {
      "id": 3,
      "name": "Player 3",
      "roleType": "wolf",
      "faction": "wolf",
      "isAlive": true
    }
  ]
}
```

---

## 2. 聊天流 (chat_message)

统一动作、发言和系统播报。

### 2.1 数据结构

```typescript
interface ChatMessage {
  id: string;
  type: "speak" | "action" | "system";
  playerId?: number;
  playerName?: string;
  content: string;
  privateThought?: string; // 仅在视角允许时下发
  timestamp: number;
}
```

### 2.2 视角隔离规则

`privateThought` 只有在以下情况才能下发：

- `viewId === 0` (上帝视角)
- `viewId === message.playerId` (玩家自己的视角)

否则必须设为 `undefined`。

### 2.3 示例

**示例 1：公开发言**

```json
{
  "id": "msg-001",
  "type": "speak",
  "playerId": 1,
  "playerName": "Player 1",
  "content": "我是好人，大家相信我！",
  "privateThought": "其实我是狼人，我要假装好人",
  "timestamp": 1234567890
}
```

**示例 2：系统播报**

```json
{
  "id": "msg-002",
  "type": "system",
  "content": "昨晚 Player 2 被杀害了。",
  "timestamp": 1234567891
}
```

---

## 3. 动作提交 (submit_action)

### 3.1 数据结构

```typescript
interface SubmitAction {
  actionType: ActionType;
  targetId?: number;
  content?: string;
}

enum ActionType {
  Kill = "kill",
  Save = "save",
  Poison = "poison",
  Check = "check",
  Speak = "speak",
  Vote = "vote",
  NoAction = "no_action",
  SelfDestruct = "self_destruct",
  SheriffRun = "sheriff_run",
  SheriffVote = "sheriff_vote",
}
```

### 3.2 示例

**示例 1：狼人杀人**

```json
{
  "actionType": "kill",
  "targetId": 2
}
```

**示例 2：玩家发言**

```json
{
  "actionType": "speak",
  "content": "我是好人，大家相信我！"
}
```

**示例 3：狼人自爆**

```json
{
  "actionType": "self_destruct"
}
```

---

## 4. WebSocket 事件

### 4.1 事件列表

| 事件名              | 方向          | 说明          |
| ------------------- | ------------- | ------------- |
| `hostGame`          | Client→Server | 房主创建游戏  |
| `joinGame`          | Client→Server | 玩家加入游戏  |
| `gameStarted`       | Server→Client | 游戏开始      |
| `gameStateUpdate`   | Server→Client | 游戏状态更新  |
| `chatMessage`       | Server→Client | 聊天消息      |
| `submitAction`      | Client→Server | 提交动作      |
| `actionReceived`    | Server→Client | 动作已接收    |
| `playerJoined/Left` | Server→Client | 玩家加入/离开 |
| `gameOver`          | Server→Client | 游戏结束      |
| `ping`              | Client→Server | 心跳检测      |
| `pong`              | Server→Client | 心跳响应      |
| `requestFullState`  | Client→Server | 请求全量状态  |

### 4.2 事件示例

**示例：gameStateUpdate**

```json
{
  "type": "gameStateUpdate",
  "data": {
    "phase": "Day_Start",
    "round": 1,
    "players": [
      {
        "id": 1,
        "name": "Player 1",
        "roleType": "wolf",
        "faction": "wolf",
        "isAlive": true
      }
    ],
    "deadPlayerIds": [],
    "history": [],
    "witchHasAntidote": true,
    "witchHasPoison": true,
    "currentSpeechIndex": 0,
    "phaseStack": []
  },
  "timestamp": 1234567890
}
```

---

## 5. 心跳与重连机制

### 5.1 心跳检测 (ping/pong)

为了防止连接空闲超时，Client 和 Server 必须通过 `ping/pong` 保持存活。

**心跳间隔：** 30 秒

**Client 实现：**

```typescript
// 前端定时发送 ping
setInterval(() => {
  socket.emit("ping", { timestamp: Date.now() });
}, 30000);

// 前端监听 pong
socket.on("pong", (data) => {
  const latency = Date.now() - data.timestamp;
  console.log(`Heartbeat latency: ${latency}ms`);
});
```

**Server 实现：**

```typescript
// 后端监听 ping 并回复 pong
socket.on("ping", (data) => {
  socket.emit("pong", { timestamp: data.timestamp });
});
```

### 5.2 重连与状态恢复

当检测到连接断开时，前端必须自动重连，并在重连成功后请求全量 `gameStateUpdate` 以恢复 UI。

**重连流程：**

1. 前端检测到连接断开
2. 前端开始自动重连（指数退避策略）
3. 重连成功后，前端发送 `requestFullState` 事件
4. 后端立即发送完整的 `gameStateUpdate`

**前端实现：**

```typescript
// 重连成功后请求全量状态
socket.on("connect", () => {
  socket.emit("requestFullState");
});

// 接收全量状态更新
socket.on("gameStateUpdate", (state) => {
  // 完全替换本地状态
  gameStore.replaceState(state);
});
```

**后端实现：**

```typescript
// 监听 requestFullState 并发送完整状态
socket.on("requestFullState", () => {
  const fullState = gameEngine.exportGameState();
  socket.emit("gameStateUpdate", fullState);
});
```

---

## 6. 战局复盘 REST API

### 6.1 获取战局列表

**接口：** `GET /api/matches`

**查询参数：**

| 参数名   | 类型   | 必填 | 说明                  |
| -------- | ------ | ---- | --------------------- |
| `limit`  | number | 否   | 返回数量限制，默认 20 |
| `offset` | number | 否   | 偏移量，默认 0        |

**响应示例：**

```json
{
  "success": true,
  "data": [
    {
      "id": "match-001",
      "timestamp": 1234567890,
      "playerCount": 6,
      "winner": "villager",
      "duration": 123456
    },
    {
      "id": "match-002",
      "timestamp": 1234567891,
      "playerCount": 6,
      "winner": "wolf",
      "duration": 98765
    }
  ]
}
```

### 6.2 获取单局战局详情

**接口：** `GET /api/matches/:id`

**路径参数：**

| 参数名 | 类型   | 必填 | 说明    |
| ------ | ------ | ---- | ------- |
| `id`   | string | 是   | 战局 ID |

**响应：** JSONL 格式的完整游戏日志

**响应示例：**

```jsonl
{"type":"game_started","data":{"players":[{"id":1,"name":"Player 1"},{"id":2,"name":"Player 2"}]}}
{"type":"phase_changed","data":{"phase":"Night_Start"}}
{"type":"player_action","data":{"playerId":1,"actionType":"kill","targetId":2}}
```

---

## 7. 验收标准

- [ ] 实现视角隔离的 `gameStateUpdate`
- [ ] 实现统一的 `chat_message`
- [ ] 实现 `submit_action`
- [ ] 所有事件符合 JSON 示例
- [ ] 实现 ping/pong 心跳机制
- [ ] 实现自动重连与全量状态恢复
- [ ] 实现 `GET /api/matches` 接口
- [ ] 实现 `GET /api/matches/:id` 接口
