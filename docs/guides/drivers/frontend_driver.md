# Frontend Driver（索引版）

## 1. 当前代码详细文档

前端代码主线：

1. 总入口：
   - `frontend/src/App.vue`
2. 主链路：
   - `frontend/src/composables/useGameStore.ts`
   - `frontend/src/composables/useWebSocket.ts`
3. 组件层：
   - `frontend/src/components/*`
4. 类型与工具：
   - `frontend/src/types/index.ts`
   - `frontend/src/lib/utils.ts`

## 2. 开发任务清单

- [ ] `T01` 在 `frontend/src/composables/useWebSocket.ts` 对齐 V3 新事件字段（阶段、投票权重、中断状态）。
- [ ] `T02` 在 `frontend/src/composables/useGameStore.ts` 适配警长竞选/警徽流转的状态更新逻辑。
- [ ] `T03` 在 `frontend/src/types/index.ts` 补齐 V3 事件类型定义并消除 `any` 漏洞。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） WebSocket 收到新事件后，页面状态可正确渲染阶段与中断信息。
- [ ] `A02`（对应: `T02`） 警长相关 UI 在竞选、移交、撕毁场景下状态一致。
- [ ] `A03`（对应: `T03`） TypeScript 前端构建无新增类型错误，事件 payload 全量有类型约束。
