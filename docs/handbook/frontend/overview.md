# 狼人杀竞技场 - 前端（当前）

## 1. 文档优先级

1. 实时协议：`docs/apis/game_event_socket_v1_spec.md`
2. 会话生命周期：`docs/apis/session_rest_api_v1_spec.md`
3. 前端接入规范：`docs/specs/frontend/game_event_consumption_spec_v3.md`

说明：
1. 本文档只提供“当前结构解释与阅读入口”。
2. 协议与迁移约束以上述文档为准。

## 2. 当前技术栈

1. 运行时：Vue 3 + TypeScript
2. 构建：Vite
3. 实时通信：Socket.IO client
4. 状态管理：当前并存 composable store 与 Pinia store
5. UI：shadcn-vue 风格组件 + 自定义赛博朋克样式

## 3. 当前目录结构（frontend/src）

```text
components/     # 页面组件与 UI 原子组件
composables/    # 旧 V3 store / mock / websocket 组合式逻辑
mocks/          # V2 mock engine
network/        # V2 socket 适配层
stores/         # Pinia store（当前 V2 chatflow 主要使用）
types/          # 前端共享类型
App.vue         # 顶层页面装配
main.ts         # 应用入口
style.css       # 全局视觉样式
```

## 4. 当前实现状态

当前前端同时存在两条主线：

### 4.1 V3 兼容主线（旧）

1. `composables/useGameStore.ts`
2. `composables/useWebSocket.ts`

特点：
1. 已能消费后端 `gameEvent`
2. 更贴近当前 V3 后端的实时广播协议
3. 但页面主入口未完全围绕它组织

### 4.2 V2 chatflow 主线（新引入）

1. `stores/gameStore.ts`
2. `network/socket.ts`
3. `components/ChatFlow*.vue`

特点：
1. 强依赖聊天流与视角切换体验
2. 当前主要服务于 mock / 本地演示
3. 仍带有 V2 风格协议假设（如 `gameStateUpdate`、`chatMessage`）

## 5. 当前迁移方向

目标不是继续扩展 V2 专用协议，而是：

1. 保留 V2 chatflow 的 UI 体验与组件资产
2. 将前端正式联机路径统一切到增强版 V3 `gameEvent`
3. 会话创建/停止/恢复统一走 `/api/v1/sessions*`

换句话说：
1. UI 资产可以继续使用 V2 chatflow
2. 但真实后端协议必须升级为增强版 V3 `gameEvent`

## 6. 推荐阅读主线

1. 顶层页面：`frontend/src/App.vue`
2. 旧 V3 store：`frontend/src/composables/useGameStore.ts`
3. V2 chatflow store：`frontend/src/stores/gameStore.ts`
4. V2 chatflow 视图：`frontend/src/components/ChatFlow.vue`
5. 前端正式迁移规范：`docs/specs/frontend/game_event_consumption_spec_v3.md`

## 7. 当前结论

1. 前端页面、类型检查、构建与 Playwright 已可稳定运行
2. 但“正式联机协议”尚未完全统一到增强版 V3 `gameEvent`
3. 后续实现应以增强版 `gameEvent` 为唯一正式实时协议，逐步压缩 V2 协议假设
