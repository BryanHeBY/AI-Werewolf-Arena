# backend rebuild 文档索引

## 1. 当前代码详细文档

本目录是 V3 后端“重构前置作战包”，用于在正式改代码前统一目标、分工、顺序与验收口径。

建议阅读顺序：

1. `00_rebuild_charter.md`：重构边界、目标、非目标。
2. `01_target_architecture_and_structure.md`：V3 目标目录结构与模块职责。
3. `02_execution_phases.md`：分阶段推进路径与里程碑出口条件。
4. `03_task_backlog.md`：可直接执行的任务看板（按模块拆分）。
5. `04_test_quality_gates.md`：测试策略与质量闸门。
6. `05_cutover_and_rollback.md`：切换方案、灰度策略、回滚预案。
7. `06_dependency_rules.md`：V3 分层依赖约束（禁止跨层反向依赖）。

当前进度快照（2026-04-08）：

1. P0 已完成：`docs/codebase` 已按当前源码重建。
2. P1 已完成：`backend/src/{app,domain,engine}` 已落地串行状态机与 ECS 组件/系统骨架。
3. P2 已完成：`backend/src/gateway` 已落地 schema 注册、动作校验与输入清洗。
4. P3 已完成（MVP 基线）：`backend/tests/v3` 覆盖白痴、猎人、守卫、女巫、自爆中断关键规则并通过。
5. P4 未开始：transport 与前端联调、灰度切换与回滚演练待执行。

驱动关系：

- 最高规范：`docs/specs/backend_architecture_whitepaper_v3.md`
- MVP 范围：`docs/specs/v3_mvp_requirements.md`
- 当前代码镜像：`docs/codebase/backend/README.md`

## 2. 未来目标 TODO

- [ ] 为每个阶段补充“负责人/预计工时/风险等级”。
- [x] 增加“每日推进记录”并保持与任务看板一致。
- [x] 每次结构变更后，同步更新目标目录图与迁移映射。

## 3. 验收标准

- [ ] 团队可仅依赖本目录启动后端重构，不需额外口头说明。
- [ ] 每个开发任务能追溯到白皮书条款与代码文件节点。
- [ ] 执行阶段、测试阶段、切换阶段都有明确入口文档与退出条件。
