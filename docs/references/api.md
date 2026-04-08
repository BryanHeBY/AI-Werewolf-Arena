# API 契约文档（树形拆分入口）

## 1. 当前代码详细文档

当前 API 契约已拆分到树形文档，建议从以下入口阅读：

- 后端服务入口与事件发射：`backend/src/server/index.ts`
- Socket 连接与 register：`backend/src/server/socket.ts`
- 事件视图映射：`backend/src/server/view_mapper.ts`
- 会话管理：`backend/src/server/v3_session_manager.ts`
- 前端事件消费：`frontend/src/composables/useGameStore.ts`
- 前端 WS 封装：`frontend/src/composables/useWebSocket.ts`

## 2. 开发任务清单

- [ ] `T01` 在 `backend/src/server/view_mapper.ts` 与 `frontend/src/types/index.ts` 对齐会话/阶段/投票事件字段定义。
- [ ] `T02` 在 `backend/src/server/socket.ts` 增加非法消息与重连恢复错误响应字段，并在前端消费层处理。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） 后端事件 payload 与前端 TypeScript 类型一致，无字段漂移。
- [ ] `A02`（对应: `T02`） 重连与错误事件在前端可被识别并显示，不出现静默失败。
- [ ] `A03`（对应: `T02`） `session_manager.test.ts` 与前端联调验证均通过。
