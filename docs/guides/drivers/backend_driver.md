# Backend Driver（索引版）

## 1. 当前代码详细文档

后端详细文档已拆分为树形结构（按源码路径镜像）：

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
   - `docs/guides/backend_rebuild/07_module_maturity_matrix.md`
   - `docs/guides/backend_rebuild/08_cutover_runbook.md`
   - `docs/guides/backend_rebuild/09_rollback_drill_template.md`
4. 总入口：
   - `docs/codebase/backend/README.md`
5. V3 核心模块：
   - `docs/codebase/backend/src/app/README.md`
   - `docs/codebase/backend/src/domain/README.md`
   - `docs/codebase/backend/src/engine/README.md`
   - `docs/codebase/backend/src/gateway/README.md`
   - `docs/codebase/backend/src/memory/README.md`
   - `docs/codebase/backend/src/scenarios/README.md`
   - `docs/codebase/backend/src/v3/README.md`
6. 服务与通信：
   - `docs/codebase/backend/src/server/README.md`
   - `docs/codebase/backend/src/infra/transport/README.md`

当前阶段状态（2026-04-08）：

1. V3 P0-P4 已完成（ECS、Phase、Gateway、事件拦截、Transport、服务入口）。
2. 全量后端测试已切换到 V3：`backend/tests/v3/*`。
3. V2 源码与旧测试已清理，当前为 V3 单栈。

## 2. 未来目标 TODO

- [x] 为 `docs/codebase/backend/src/*` 各父级 README 增加依赖图（上游/下游）。
- [x] 将后端“模块成熟度”标注到各目录 README（MVP/Beta/Stable）。
- [x] 对所有关键文件文档补充“风险等级 + 责任人”字段。
- [x] 将白皮书条款按模块拆解为“实现状态矩阵”（未开始/开发中/已完成）。
- [x] 将重构作战包中的任务状态实时回写到本索引。

## 3. 验收标准

- [x] backend/src 每个源码文件都存在 `docs/codebase/backend/src/<file>.md`。
- [x] 每个目录节点都有 `README.md` 且可导航到子节点。
- [x] 发生后端代码改动时，对应 codebase 文档同步更新。
- [x] 后端开发评审时，能从代码直接追溯到白皮书条款与 MVP 验收项。
- [x] 重构启动前，团队已按“重构作战包”完成范围、阶段、测试与回滚对齐。
