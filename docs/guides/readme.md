# guides 索引

## 1. 当前代码详细文档

本目录负责“如何开展开发”的驱动型文档：

1. 模块驱动索引：`drivers/readme.md`
2. 活动驱动索引：`activities/readme.md`
3. 后端重构作战包：`backend_rebuild/readme.md`
4. 无人值守循环准则：`unattended_todo_loop.md`

核心文档直达：

1. 项目总驱动：`drivers/project_driver.md`
2. 后端驱动：`drivers/backend_driver.md`
3. 前端驱动：`drivers/frontend_driver.md`
4. 开发活动驱动：`activities/development_activity_driver.md`
5. 测试活动驱动：`activities/testing_activity_driver.md`
6. 评审与发布活动驱动：`activities/review_release_activity_driver.md`

与其他目录关系：

- 规范来源：`docs/specs/readme.md`
- 结构参考：`docs/references/readme.md`
- 代码细节：`backend/src`、`frontend/src`（以源码注释为准）

## 2. 开发任务清单

- [ ] `T01` 在 `backend/src/engine/phase_pipeline/day_pipeline.ts` 完成白天中断窗口全量实现并补测试。
- [ ] `T02` 在 `backend/src/engine/phase_pipeline/night_pipeline.ts` 完成狼队战术环与落刀结算实现并补测试。
- [ ] `T03` 在 `backend/src/engine/phase_pipeline/voting_pipeline.ts` 完成警长票权与放逐链路增强并补测试。
- [ ] `T04` 在 `backend/src/memory/*` 完成上下文压缩策略并补 `memory_compression.test.ts`。
- [ ] `T05` 在 `backend/src/config/index.ts` 与 `backend/src/server/index.ts` 完成引擎开关与回滚测试链路。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） `day_interrupt_hooks.test.ts` 通过且事件链路正确。
- [ ] `A02`（对应: `T02`） `night_wolf_tactical_loop.test.ts` 通过且顺序可复现。
- [ ] `A03`（对应: `T03`） `sheriff_pipeline.test.ts` 通过且不破坏既有用例。
- [ ] `A04`（对应: `T04`） `memory_compression.test.ts` 通过且第 3 天后流程不中断。
- [ ] `A05`（对应: `T05`） `cutover_rollback.test.ts` 通过且开关可切换。
