# Backend Architecture Whitepaper V3 开发驱动

来源规范：`docs/specs/backend/foundation/architecture/backend_architecture_whitepaper_v3.md`

## 任务
- [x] `BA01` 落地串行 phase 时序与 hooks 调度。
- [x] `BA02` 对齐 ECS 组件模型与工具鉴权模型。
- [x] `BA03` 完成模块拆分与接口契约实现。
- [x] `BA04` 补齐关键规则自动化回归用例。

## 验收
- [x] `BB01` 引擎时序、组件模型、工具链与规范一致。
- [x] `BB02` 关键规则可通过自动化回归。

## 验收证据
1. 串行时序与调度：`backend/src/game/engine/phase_manager.ts`
2. 阶段流水线：`backend/src/game/engine/phase_pipeline/{night,day,voting}_pipeline.ts`
3. ECS 组件：`backend/src/core/domain/components/*`
4. 工具鉴权与网关：`backend/src/game/gateway/{tool_gateway.ts,action_validator.ts}`
5. 编译与冒烟：`cd backend && npm run build:v3`、`cd backend && npm run smoke:v3`（均通过）
6. 回归测试：
   - `cd backend && npx jest tests/v3/phase_manager_mvp.test.ts --runInBand`
   - `cd backend && npx jest tests/v3/tool_gateway_validation.test.ts --runInBand`
