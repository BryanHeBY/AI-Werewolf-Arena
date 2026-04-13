# Backend Driver（索引版）

## 1. 当前代码详细文档

后端执行入口：

1. V3 后端开发最高规范：
   - `docs/specs/backend_architecture_whitepaper_v3.md`
2. V3 当前迭代实现要求：
   - `docs/specs/v3_mvp_requirements.md`
3. 后端重构作战包（重构前必读）：
   - `docs/guides/backend_rebuild/readme.md`
   - `docs/guides/backend_rebuild/00_rebuild_charter.md`
   - `docs/guides/backend_rebuild/01_target_architecture_and_structure.md`
   - `docs/guides/backend_rebuild/02_execution_phases.md`
   - `docs/guides/backend_rebuild/03_task_backlog.md`
   - `docs/guides/backend_rebuild/04_test_quality_gates.md`
   - `docs/guides/backend_rebuild/05_cutover_and_rollback.md`
   - `docs/guides/backend_rebuild/06_dependency_rules.md`
4. 总入口：
   - `backend/src/index.ts`
5. V3 核心模块：
   - `backend/src/app/*`
   - `backend/src/domain/*`
   - `backend/src/engine/*`
   - `backend/src/gateway/*`
   - `backend/src/memory/*`
   - `backend/src/scenarios/*`
   - `backend/src/v3/*`
6. 服务与通信：
   - `backend/src/server/*`
   - `backend/src/infra/transport/*`

当前阶段状态（2026-04-08）：

1. V3 P0-P4 已完成（ECS、Phase、Gateway、事件拦截、Transport、服务入口）。
2. 全量后端测试已切换到 V3：`backend/tests/v3/*`。
3. V2 源码与旧测试已清理，当前为 V3 单栈。

## 2. 开发任务清单

- [x] `T01` 在 `backend/src/engine/phase_pipeline/day_pipeline.ts` 实现警长定序 + 中断窗口处理并补齐测试。
- [x] `T02` 在 `backend/src/engine/phase_pipeline/night_pipeline.ts` 实现狼队战术环（随机顺序发言/投票/落刀）。
- [x] `T03` 在 `backend/src/domain` 完成组件拆分（model -> components/systems）并更新导出。
- [x] `T04` 在 `backend/src/gateway/action_validator.ts` 完成女巫/守卫/猎人边界校验扩展。
- [x] `T05` 在 `backend/src/server/index.ts` 与 `backend/src/config/index.ts` 实现 V3 开关切换与回滚路径。
- [x] `T06` 重构 `backend/src/run-test-v3.ts` 为更清晰的脚本结构（推荐 `backend/src/scripts/*`），并新增真实 LLM 行为提供器，支持跑完完整对局。

## 3. 验收标准（任务映射）

- [x] `A01`（对应: `T01`） `backend/tests/v3/day_interrupt_hooks.test.ts` 覆盖警长定序与窗口中断行为。
- [x] `A02`（对应: `T02`） `backend/tests/v3/night_wolf_tactical_loop.test.ts` 验证狼队战术环流程正确。
- [x] `A03`（对应: `T03`） `backend/src/domain/components/*` 与 `systems/*` 有真实实现且构建通过。
- [x] `A04`（对应: `T04`） `backend/tests/v3/tool_gateway_validation.test.ts` 新增边界校验场景并通过。
- [x] `A05`（对应: `T05`） 引擎开关可切换并通过 `backend/tests/v3/cutover_rollback.test.ts`。
- [x] `A06`（对应: `T06`） `backend/src/scripts/run_llm_game.ts` 可通过 `npm run run:v3:six`、`npm run run:v3:twelve` 分别执行；`npm run run:v3` 按六人→十二人顺序串行执行；`backend/tests/v3/llm_action_provider.test.ts` 覆盖 JSON 解析、允许工具约束、降级策略并通过。
