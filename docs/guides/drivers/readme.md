# drivers 索引

## 1. 当前代码详细文档

本目录存放“面向模块/边界”的驱动文档：

1. 项目总驱动：`project_driver.md`
2. 后端驱动：`backend_driver.md`
3. 前端驱动：`frontend_driver.md`

定位：

- 适合做“从哪里改、改哪些模块、依赖哪些规范”的入口。
- 与活动驱动互补：模块驱动回答“改哪里”，活动驱动回答“怎么推进”。

## 2. 开发任务清单

- [ ] `T01` 后端：完成 `day_pipeline.ts`、`night_pipeline.ts`、`voting_pipeline.ts` 的规则增强任务。
- [ ] `T02` 前端：完成 `useWebSocket.ts`、`useGameStore.ts`、`types/index.ts` 的协议对齐任务。
- [ ] `T03` 跨端：完成 `session_manager.test.ts` 与前端联调自测，确认事件字段一致。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） 后端新增规则测试全部通过且无回归。
- [ ] `A02`（对应: `T02`） 前端构建通过且事件类型无 `any` 漏洞。
- [ ] `A03`（对应: `T03`） 跨端会话接口与事件流联调通过。
