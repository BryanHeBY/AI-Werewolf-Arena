# development activity driver

## 1. 当前代码详细文档

本文件定义 V3 后续开发活动的执行驱动，适用于后端优先重构阶段。

活动目标：

1. 按 `docs/specs/backend_architecture_whitepaper_v3.md` 作为后端唯一技术规范推进实现。
2. 按 `docs/specs/v3_mvp_requirements.md` 作为当前里程碑验收清单推进交付。
3. 所有实现先更新 `docs/guides/*` 任务状态，再改代码并补源码中文注释。
4. 后端重构期间以 `docs/guides/backend_rebuild/*` 作为任务分解与推进主看板。

标准开发节奏（每个任务都执行）：

1. 需求对齐：在白皮书/MVP 中定位条款与边界。
2. 影响面分析：在 `backend/src` 与 `frontend/src` 源码注释中确认涉及文件、导出项、依赖项。
3. 设计落文档：先更新相关文档中的 TODO 与验收标准。
4. 小步实现：按模块提交（core / ecs / agent / server 分层推进）。
5. 回归验证：补充或更新测试，再进行最小回归。
6. 文档回写：同步更新变更文件的 codebase 文档与 guides 状态。

建议开发顺序（V3 后端）：

1. ECS 数据层（Role/Camp/Alive/VotingRight/StatusMarks）。
2. PhaseManager 串行流程（day/night/vote + hooks）。
3. Tool 网关（校验、错误反弹、重试）。
4. 事件总线拦截（白痴、猎人、自爆中断）。
5. 服务层协议对齐（socket/broadcast）。

当前执行基线（2026-04-08）：

1. 已落地目录：`backend/src/{app,domain,engine,gateway,memory,scenarios,v3}`。
2. 已验证命令：
   - `cd backend && npx tsc -p tsconfig.v3.json --noEmit`
   - `npx jest backend/tests/v3 --runInBand`
   - `npx tsx backend/src/run-test-v3.ts`
3. 已切换为 V3 单栈：`server/index.ts` 已接管，V2 目录已清理。
4. 下一开发焦点：扩展白皮书角色库与高级机制（警长流转细化、更多角色技能链）。

## 2. 开发任务清单

- [ ] `T01` 在 `backend/src/engine/phase_pipeline/day_pipeline.ts` 实现 4 类 Action Window 与可配置开关。
- [ ] `T02` 在 `backend/src/engine/phase_pipeline/night_pipeline.ts` 实现狼队战术环与夜间优先级结算。
- [ ] `T03` 在 `backend/src/engine/phase_pipeline/voting_pipeline.ts` 与 `domain/world.ts` 实现警长竞选、票权加成、移交/撕毁流程。
- [ ] `T04` 在 `backend/src/domain/components/*` 完成组件拆分并更新 `backend/src/domain/model.ts` 聚合导出。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） `backend/tests/v3/day_interrupt_hooks.test.ts` 覆盖四类窗口并通过。
- [ ] `A02`（对应: `T02`） `backend/tests/v3/night_wolf_tactical_loop.test.ts` 覆盖狼队战术环并通过。
- [ ] `A03`（对应: `T03`） `backend/tests/v3/sheriff_pipeline.test.ts` 覆盖竞选与票权流程并通过。
- [ ] `A04`（对应: `T04`） 构建通过且 `domain/components/*` 文档与代码一致。
