# API 契约文档（树形拆分入口）

## 1. 当前代码详细文档

当前 API 契约已拆分到树形文档，建议从以下入口阅读：

- 后端服务入口与事件发射：`docs/codebase/backend/src/server/index.ts.md`
- Socket 连接与 register：`docs/codebase/backend/src/server/socket.ts.md`
- 广播协议类型：`docs/codebase/backend/src/core/types.ts.md`
- 广播实现：`docs/codebase/backend/src/broadcaster/Broadcaster.ts.md`
- 前端事件消费：`docs/codebase/frontend/src/composables/useGameStore.ts.md`
- 前端 WS 封装：`docs/codebase/frontend/src/composables/useWebSocket.ts.md`

## 2. 未来目标 TODO

- [x] 在 API 文档中按事件名建立单独文件（如 `events/game_started.md`）。
- [x] 增加示例 payload 与错误场景（字段缺失、重连恢复）。

## 3. 验收标准

- [x] 事件名、字段与代码一致。
- [x] 前后端对同一事件的字段定义无冲突。
- [x] 任一事件变更后，本文件与对应树形文档同步更新。
