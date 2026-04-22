# backend rebuild charter

## 1. 当前代码详细文档

本文定义 V3 后端重构的“总原则与边界”，用于约束后续所有代码改动。

重构目标：

1. 将当前 V2 后端演进为“严格串行状态机 + ECS 组件化 + Tool Gateway”架构。
2. 先跑通 MVP 双基准板子：6 人暗牌屠城局、12 人标准局。
3. 在重构过程中保持文档先行，确保每次实现都有对应任务与验收条目。

非目标（当前阶段不做）：

1. 一次性实现全量角色库（先聚焦 MVP 角色与机制闭环）。
2. 全量性能优化（先保证正确性，再做性能基线优化）。
3. 前端大规模视觉改版（仅做协议对齐需要的最小改动）。

重构原则：

1. 先定义目标目录和模块契约，再开始迁移代码。
2. 任何规则改动必须可被自动化测试覆盖。
3. 任何高风险改动必须保留回滚路径。
4. 任何源码变更必须同步更新源码中文注释与对应 `docs/guides` 任务状态。

## 2. 开发任务清单

- [x] `T01` 在 `backend/src/engine/phase_pipeline/day_pipeline.ts` 实现可配置 Action Window（`on_daybreak`、`on_pre_election`、`on_pre_vote`、`on_per_speech_gap`）并接入 `PhaseManager`。
- [x] `T02` 在 `backend/src/engine/phase_pipeline/night_pipeline.ts` 实现狼队战术环（随机顺序发言 -> 同序投票 -> 票多落刀）并写入事件日志。
- [x] `T03` 在 `backend/src/engine/event_registry.ts` 增加遗言触发规则（仅首夜死亡与白天放逐），并补齐对应测试。

## 3. 验收标准（任务映射）

- [x] `A01`（对应: `T01`） `backend/tests/v3/day_interrupt_hooks.test.ts` 覆盖 4 类窗口触发与中断，且 `npm test -- --runInBand` 通过。
- [x] `A02`（对应: `T02`） `backend/tests/v3/night_wolf_tactical_loop.test.ts` 验证“发言顺序=投票顺序=计票结果”并可重复运行通过。
- [x] `A03`（对应: `T03`） `backend/tests/v3/last_words_rules.test.ts` 验证遗言边界（首夜死/放逐死有遗言，自爆/连带死无遗言）。
