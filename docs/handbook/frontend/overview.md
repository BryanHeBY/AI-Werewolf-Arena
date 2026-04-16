# 狼人杀竞技场 - 前端

前端是 AI 狼人杀竞技场的用户界面，提供游戏大厅、游戏界面和完整的玩家交互体验。

## 技术栈

- **框架**: Vue 3.5.13
- **构建工具**: Vite 7.0.0
- **UI 组件库**: shadcn-vue (Tailwind CSS)
- **WebSocket**: Socket.IO v4.8.1
- **语言**: TypeScript

## 项目结构

```
frontend/
├── src/
│   ├── components/       # 组件
│   │   └── ui/           # shadcn-vue 组件
│   ├── composables/      # 组合式函数
│   │   ├── useGameStore.ts      # 游戏状态管理
│   │   ├── useWebSocket.ts       # WebSocket 连接管理
│   │   └── mockDataEngine.ts     # 模拟数据（开发用）
│   ├── types/            # 类型定义
│   │   └── index.ts
│   ├── App.vue           # 主应用
│   ├── main.ts           # 入口文件
│   └── style.css         # 全局样式
├── public/               # 静态资源
├── dist/                 # 编译输出
├── components.json       # shadcn-vue 配置
├── tailwind.config.js    # Tailwind 配置
└── package.json
```

## 核心组件

### App.vue

主应用组件，包含四个主要视图：

1. **HomeView** - 首页（选择加入/创建游戏）
2. **WaitRoomView** - 等待房间（房主配置游戏，等待玩家加入）
3. **GameView** - 游戏界面（完整的游戏流程）
4. **EndGameView** - 游戏结束（显示结果）

### useGameStore.ts

游戏状态管理的核心，使用 Vue 3 的响应式系统：

**主要状态**:

- `currentView`: 当前视图
- `gamePhase`: 当前游戏阶段
- `currentPlayers`: 玩家列表
- `currentPlayerId`: 当前玩家 ID
- `gameLog`: 游戏日志
- `nightResult`: 夜晚行动结果
- `voteResult`: 投票结果

**主要方法**:

- `setCurrentView()` - 切换视图
- `handleServerEvent()` - 处理服务器事件
- `handlePlayerAction()` - 提交玩家行动
- `speak()` - 玩家发言
- `vote()` - 玩家投票

### useWebSocket.ts

WebSocket 连接管理：

- 自动重连
- 事件监听器管理
- 消息发送和接收

**主要方法**:

- `connect()` - 连接服务器
- `disconnect()` - 断开连接
- `send()` - 发送消息
- `on()` / `off()` - 事件监听

## UI 组件 (shadcn-vue)

项目使用 shadcn-vue 组件库，已安装的组件：

- **Button** - 按钮
- **Card** - 卡片
- **Input** - 输入框
- **Select** - 选择框
- **Checkbox** - 复选框
- **Avatar** - 头像
- **Badge** - 徽章
- **Dialog** - 对话框
- **Label** - 标签
- **Separator** - 分隔线
- **Skeleton** - 骨架屏

## WebSocket 事件处理

### 接收事件 (Server → Client)

| 事件名            | 处理函数              | 说明       |
| ----------------- | --------------------- | ---------- |
| `gameStarted`     | `onGameStarted()`     | 游戏开始   |
| `phaseChanged`    | `onPhaseChanged()`    | 阶段变更   |
| `gameStateUpdate` | `onGameStateUpdate()` | 状态更新   |
| `actionReceived`  | `onActionReceived()`  | 行动已接收 |
| `playerJoined`    | `onPlayerJoined()`    | 玩家加入   |
| `playerLeft`      | `onPlayerLeft()`      | 玩家离开   |
| `gameOver`        | `onGameOver()`        | 游戏结束   |

### 发送事件 (Client → Server)

| 事件名         | 触发时机     |
| -------------- | ------------ |
| `hostGame`     | 房主创建游戏 |
| `joinGame`     | 玩家加入游戏 |
| `playerAction` | 玩家提交行动 |

## 游戏流程

### 1. 首页

- 选择"创建游戏"或"加入游戏"

### 2. 等待房间

- 房主配置游戏人数和规则
- 等待其他玩家加入
- 房主点击"开始游戏"

### 3. 游戏界面

- 显示当前阶段
- 显示玩家列表（头像、身份、存活状态）
- 游戏日志区域
- 根据阶段显示不同的行动界面：
  - **夜晚阶段**: 狼人选择击杀目标、预言家查验、女巫用药
  - **白天阶段**: 玩家依次发言、投票

### 4. 游戏结束

- 显示获胜阵营
- 显示所有玩家的真实身份
- 可返回首页

## 开发指南

### 安装依赖

```bash
cd frontend
bun install
```

### 开发模式

```bash
bun run dev
```

默认地址：`http://localhost:5173`

### 编译

```bash
bun run build
```

### 预览生产构建

```bash
bun run preview
```

### 添加 shadcn-vue 组件

```bash
bunx shadcn-vue@latest add [component-name]
```

## 类型定义

主要类型定义在 `src/types/index.ts`：

- `PlayerInfo` - 玩家信息
- `GameState` - 游戏状态
- `PlayerAction` - 玩家行动
- `BroadcastEvent` - 广播事件
- `GameConfig` - 游戏配置

---

_相关文件：`../backend/`（后端服务）_
