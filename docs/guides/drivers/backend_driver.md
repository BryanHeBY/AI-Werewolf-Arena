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

- [ ] `T01` 在 `backend/src/engine/phase_pipeline/day_pipeline.ts` 实现警长定序 + 中断窗口处理并补齐测试。
- [ ] `T02` 在 `backend/src/engine/phase_pipeline/night_pipeline.ts` 实现狼队战术环（随机顺序发言/投票/落刀）。
- [ ] `T03` 在 `backend/src/domain` 完成组件拆分（model -> components/systems）并更新导出。
- [ ] `T04` 在 `backend/src/gateway/action_validator.ts` 完成女巫/守卫/猎人边界校验扩展。
- [ ] `T05` 在 `backend/src/server/index.ts` 与 `backend/src/config/index.ts` 实现 V3 开关切换与回滚路径。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） `backend/tests/v3/day_interrupt_hooks.test.ts` 覆盖警长定序与窗口中断行为。
- [ ] `A02`（对应: `T02`） `backend/tests/v3/night_wolf_tactical_loop.test.ts` 验证狼队战术环流程正确。
- [ ] `A03`（对应: `T03`） `backend/src/domain/components/*` 与 `systems/*` 有真实实现且构建通过。
- [ ] `A04`（对应: `T04`） `backend/tests/v3/tool_gateway_validation.test.ts` 新增边界校验场景并通过。
- [ ] `A05`（对应: `T05`） 引擎开关可切换并通过 `backend/tests/v3/cutover_rollback.test.ts`。
