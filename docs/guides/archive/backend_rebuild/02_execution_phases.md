# backend execution phases

## 1. 当前代码详细文档

本文定义 V3 后端重构的阶段推进策略，强调“可停、可验、可回滚”。

阶段 P0：重构基线冻结（文档与现状）`[已完成 2026-04-08]`

1. 冻结 `backend/src` 并完成目录镜像文档。
2. 确认源码中文注释与现状一致。
3. 明确 V3 目标目录与阶段输出物。

阶段 P1：ECS 与核心流程骨架`[已完成 2026-04-08]`

1. 建立 `domain/components`（Role/Camp/Alive/VotingRight/StatusMarks）。
2. 建立 `engine/phase_manager.ts` 与 day/night/voting 基础 pipeline。
3. 建立 `domain/systems` 的 `damage_resolution_system` 与 `win_condition_system`。

阶段 P2：Tool Gateway 与规则鉴权`[已完成 2026-04-08]`

1. 建立 tool schema（`guard`/`use_potion`/`shoot`/`self_destruct`）。
2. 建立 action validator，覆盖同守、自救限制、双药限制、非法技能。
3. 打通“错误回弹 + 重试”路径。

阶段 P3：事件拦截与 MVP 机制闭环`[已完成 2026-04-08]`

1. 实现 `EventRegistry`：白痴免死、猎人闷枪/开枪、自爆中断跳夜。
2. 完成 6 人局闭环。
3. 完成 12 人局关键机制闭环。

阶段 P4：联调、稳定性与切换`[已完成 2026-04-08]`

1. 接入 transport 与前端协议联调（`server/v3_session_manager.ts` + `server/view_mapper.ts`）。
2. 新增 V3 会话生命周期 API（`/api/start-game`、`/api/stop-game`、`/api/session`）。
3. 完成 V2 代码与旧测试清理，服务入口切换到 V3。

阶段出口条件：

1. P1 出口：核心流程可跑通一个最小夜晚-白天循环。
2. P2 出口：关键 Tool 都有 schema + 鉴权 + 错误回弹。
3. P3 出口：6/12 人 MVP 用例全部通过。
4. P4 出口：联调稳定，发布与回滚脚本可执行。

当前验证结果（2026-04-08）：

1. V3 定向类型检查已通过：`cd backend && npx tsc -p tsconfig.v3.json --noEmit`
2. V3 MVP 测试已通过：`npx jest backend/tests/v3 --runInBand`
3. V3 运行演示已通过：`npx tsx backend/src/run-test-v3.ts`
4. 全量构建通过：`cd backend && npm run build`
5. 全量测试通过：`cd backend && npm test -- --runInBand`
6. 服务冒烟通过：`/api/status`、`/api/start-game`、`/api/session`
7. 结论：P0-P4 已闭环，后续进入“角色扩展与复杂机制实现”阶段。

阶段交付粒度（预计提交数）：

| 阶段 | 预计提交数 | 最小交付粒度 |
| --- | --- | --- |
| P0 | 1-2 | 文档索引与当前代码镜像一致，基础脚本可运行 |
| P1 | 4-6 | ECS 组件 + phase manager + 最小夜昼循环可运行 |
| P2 | 3-5 | Tool schema、action validator、错误回弹闭环 |
| P3 | 5-8 | 白痴/猎人/自爆事件拦截 + 6/12 人 MVP 场景可测 |
| P4 | 3-5 | server 接口切换 + 联调 + 冒烟 + V2 清理 |

阶段依赖与并行策略：

| 阶段 | 阻塞依赖 | 可并行任务 |
| --- | --- | --- |
| P0 | 无（启动阶段） | 文档索引整理、依赖规则梳理 |
| P1 | P0 文档基线完成 | 组件建模与 phase pipeline 可并行 |
| P2 | P1 夜昼循环可运行 | schema 编写与 validator 实现可并行 |
| P3 | P2 工具鉴权闭环 | 6 人与 12 人场景回归可并行推进 |
| P4 | P3 MVP 用例稳定通过 | API 联调、观测面板、回滚演练可并行 |

阶段失败回退稳定点：

| 阶段 | 失败判定信号 | 回退稳定点 |
| --- | --- | --- |
| P1 | 最小夜昼循环无法完成或状态异常 | 回退到 P0 基线提交，仅保留文档与空骨架 |
| P2 | Tool 校验失效或非法动作无法拦截 | 回退到 P1 稳定版，保留 ECS + phase manager |
| P3 | MVP 关键机制回归失败 | 回退到 P2 稳定版，关闭事件拦截增量改动 |
| P4 | 联调失败或线上冒烟异常 | 回退到 P3 稳定版，暂不切换对外入口 |

## 2. 开发任务清单

- [x] `T01` P5 角色扩展第一批：在 `backend/src/v3/action_providers.ts` 与 `backend/src/domain/world.ts` 补齐女巫/守卫/猎人边界规则（禁自救、双药限制、毒死闷枪）。
- [x] `T02` P6 白天流程增强：在 `backend/src/engine/phase_pipeline/day_pipeline.ts` 与 `voting_pipeline.ts` 实现警长竞选、1.5 票权、发言方向选择。
- [x] `T03` P7 记忆稳定性增强：在 `backend/src/memory/rolling_summary.ts` 与 `prompt_assembler.ts` 增加按阈值压缩与摘要替换策略。

## 3. 验收标准（任务映射）

- [x] `A01`（对应: `T01`） `backend/tests/v3/tool_gateway_validation.test.ts` 与 `event_registry_hooks.test.ts` 新增边界场景并全部通过。
- [x] `A02`（对应: `T02`） `backend/tests/v3/sheriff_pipeline.test.ts` 覆盖竞选、警徽移交、1.5 票结算与发言方向。
- [x] `A03`（对应: `T03`） 在 12 人局模拟第 3 天后上下文仍可运行，且摘要替换日志可追踪。
