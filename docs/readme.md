# docs 总览

## 1. 当前代码详细文档

当前 `docs/` 目录重构为三层主入口：

1. `guides/`：开发驱动与分端入口
   - `docs/guides/readme.md`
   - `docs/guides/drivers/readme.md`
   - `docs/guides/activities/readme.md`
   - `docs/guides/backend_rebuild/readme.md`
   - `docs/guides/unattended_todo_loop.md`
2. `references/`：架构/API 参考文档
   - `docs/references/readme.md`
3. `specs/`：V3 白皮书与 MVP 规范
   - `docs/specs/readme.md`
4. 源码目录：`backend/src`、`frontend/src`（代码说明以源码内中文注释为准）

推荐阅读顺序：

1. `docs/specs/backend_architecture_whitepaper_v3.md`
2. `docs/specs/v3_mvp_requirements.md`
3. `docs/guides/backend_rebuild/readme.md`
4. `docs/guides/drivers/project_driver.md`
5. `backend/src/engine/phase_manager.ts` 与 `frontend/src/composables/useGameStore.ts`

当前推进状态（2026-04-08）：

1. V3 后端已完成 P0-P4（含服务接入、协议联调、切换清理）。
2. 代码说明已迁移到源码中文注释，`docs/codebase` 已删除。
3. 当前主线进入“白皮书全角色与高级机制扩展”阶段。

## 2. 开发任务清单

- [ ] `T01` 按 `docs/guides/backend_rebuild/00_rebuild_charter.md` 完成 Action Window 与狼队战术环开发。
- [ ] `T02` 按 `docs/guides/backend_rebuild/01_target_architecture_and_structure.md` 完成 domain 拆分与 hooks 实装。
- [ ] `T03` 按 `docs/guides/backend_rebuild/04_test_quality_gates.md` 补齐 night/day 新增测试并分层执行。
- [ ] `T04` 按 `docs/guides/backend_rebuild/05_cutover_and_rollback.md` 完成引擎开关与回滚测试。
- [ ] `T05` 按 `docs/guides/backend_rebuild/06_dependency_rules.md` 完成依赖边界 lint 规则与本地阻断脚本。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） `backend/tests/v3/day_interrupt_hooks.test.ts` 与 `night_wolf_tactical_loop.test.ts` 全通过。
- [ ] `A02`（对应: `T02`） domain 与 engine hooks 的目录结构改造完成且 `npm run build` 通过。
- [ ] `A03`（对应: `T03`） `npm run test:quick` 与 `npm run test:full` 均可稳定执行。
- [ ] `A04`（对应: `T04`） 可通过 `V3_ENGINE_ENABLED` 完成引擎切换并通过回滚测试。
- [ ] `A05`（对应: `T05`） lint 规则可在本地命令中阻断跨层反向依赖提交。
