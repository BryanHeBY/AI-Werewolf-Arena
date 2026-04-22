# Technical Whitepaper V3 开发驱动

来源规范：`docs/specs/backend/foundation/architecture/technical_whitepaper_v3.md`

## 任务
- [x] `TW01` 落地 OOP 状态机 + ECS 混合架构。
- [x] `TW02` 全关键行为统一 Function Calling。
- [x] `TW03` 完整落地夜间狼队环与白天中断钩子。
- [x] `TW04` 完成冲突判定与可扩展注册机制。

## 验收
- [x] `TA01` 核心流程稳定运行并可复现。
- [x] `TA02` 新角色/新规则可注册接入，无需改核心骨架。

## 验收证据
1. OOP+ECS：`backend/src/game/engine/*` + `backend/src/core/domain/*`
2. Function Calling 主链路：`backend/src/ai/agents/llm/llm_action_provider.ts`
3. 夜间狼队环/白天中断：`backend/src/game/mechanisms/roles/wolf/night_stages.ts`、`backend/src/game/engine/phase_pipeline/{night,day,voting}_pipeline.ts`
4. 注册机制：`backend/src/game/mechanisms/registries/*`、`backend/src/game/mechanisms/roles/*/profile.ts`
5. 命令通过：`cd backend && npm run build:v3`、`cd backend && npm run smoke:v3`
