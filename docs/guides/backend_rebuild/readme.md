# backend rebuild 文档索引

## 1. 当前代码详细文档

本目录是 V3 后端“重构前置作战包”，用于在正式改代码前统一目标、分工、顺序与验收口径。

执行纪律：默认遵循 `docs/guides/unattended_todo_loop.md` 的单条 TODO 闭环规则。

建议阅读顺序：

1. `00_rebuild_charter.md`：重构边界、目标、非目标。
2. `01_target_architecture_and_structure.md`：V3 目标目录结构与模块职责。
3. `02_execution_phases.md`：分阶段推进路径与里程碑出口条件。
4. `03_task_backlog.md`：可直接执行的任务看板（按模块拆分）。
5. `04_test_quality_gates.md`：测试策略与质量闸门。
6. `05_cutover_and_rollback.md`：切换方案、灰度策略、回滚预案。
7. `06_dependency_rules.md`：V3 分层依赖约束（禁止跨层反向依赖）。

当前进度快照（2026-04-08）：

1. P0 已完成：核心模块职责说明已迁移到源码中文注释。
2. P1 已完成：`backend/src/{app,domain,engine}` 已落地串行状态机与 ECS 组件/系统骨架。
3. P2 已完成：`backend/src/gateway` 已落地 schema 注册、动作校验与输入清洗。
4. P3 已完成（MVP 基线）：`backend/tests/v3` 覆盖白痴、猎人、守卫、女巫、自爆中断关键规则并通过。
5. P4 已完成：`backend/src/server` 已接入 V3 会话管理、HTTP/Socket 协议与联调事件映射。
6. V2 清理已完成：`backend/src/{core,agent,ecs,llm,logger,broadcaster}` 与对应旧测试已移除。

驱动关系：

- 最高规范：`docs/specs/backend_architecture_whitepaper_v3.md`
- MVP 范围：`docs/specs/v3_mvp_requirements.md`
- 当前代码入口：`backend/src/index.ts`

## 2. 开发任务清单

- [x] `T01` 完成 `00_rebuild_charter.md` 的 Action Window、狼队战术环、遗言规则三项核心机制开发。
- [x] `T02` 完成 `01_target_architecture_and_structure.md` 的目录拆分与 hooks 落地任务。
- [x] `T03` 完成 `04_test_quality_gates.md` 新增测试（night_wolf_tactical_loop / day_interrupt_hooks）并接入测试命令分层。
- [x] `T04` 完成 `05_cutover_and_rollback.md` 与 `06_dependency_rules.md` 的开关切换、依赖约束、本地阻断能力。

## 3. 验收标准（任务映射）

- [x] `A01`（对应: `T01`） 4 类 Action Window 与狼队战术环在自动化测试中可复现。
- [x] `A02`（对应: `T02`） domain 拆分、hooks 落地、server/transport 边界重构均有对应代码提交与测试。
- [x] `A03`（对应: `T03`） 新增测试通过后，`test:quick` 与 `test:full` 均可稳定运行。
- [x] `A04`（对应: `T04`） lint 规则与切换开关可在本地命令中自动阻断违规发布。
