# 架构文档（树形拆分入口）

## 1. 当前代码详细文档

架构说明已按代码树拆分，主阅读路径：

- V3 后端架构总规范（Source of Truth）：`docs/specs/backend_architecture_whitepaper_v3.md`
- V3 MVP 实现要求（当前迭代执行清单）：`docs/specs/v3_mvp_requirements.md`
- 后端架构主线：`backend/src/engine/*`
- 领域模型主线：`backend/src/domain/*`
- 引擎核心：`backend/src/engine/phase_manager.ts`
- 状态中枢：`backend/src/domain/world.ts`
- 前端状态中枢：`frontend/src/composables/useGameStore.ts`

## 2. 开发任务清单

- [ ] `T01` 在 `backend/src/engine/phase_manager.ts` 落地白皮书串行时序（夜晚/白天/投票）并补齐 hooks 调度。
- [ ] `T02` 在 `backend/src/domain/components/*` 与 `backend/src/domain/systems/*` 完成组件/系统拆分与结算归位。
- [ ] `T03` 在 `frontend/src/composables/mock*.ts` 清理旧 mock 逻辑，统一接入真实事件流。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） `backend/tests/v3/phase_manager_mvp.test.ts` 与 hooks 新增断言通过。
- [ ] `A02`（对应: `T02`） `backend/tests/v3/phase_manager_mvp.test.ts`、`tool_gateway_validation.test.ts` 通过且目录拆分完成。
- [ ] `A03`（对应: `T03`） 前端运行不再依赖旧 mock 数据链路，联调事件来自后端真实广播。
