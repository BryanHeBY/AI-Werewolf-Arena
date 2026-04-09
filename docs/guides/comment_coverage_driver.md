# comment coverage driver

## 1. 当前代码详细文档

本看板用于推进“前后端注释覆盖治理”。

强制目标：

1. 每个源码文件至少有一条有效注释。
2. 每个 `export` 的 `type/function/class/interface/enum/const` 必须有就近注释。
3. 类内方法与复杂逻辑必须补充目的性注释（避免无效注释）。

校验命令：

1. 全量报告：`npm run comment:report`
2. 全量严格：`npm run comment:strict`
3. 分批严格：`node scripts/comment_coverage_check.js --strict --scope <dir>`

## 2. 开发任务清单

- [x] `T01` 建立注释覆盖自动校验能力：新增 `scripts/comment_coverage_check.js` 与根脚本命令（`comment:report/comment:strict`）。
- [x] `T02` 完成后端入口层注释覆盖：`backend/src/app` + `backend/src/scenarios`。
- [x] `T03` 完成后端领域层注释覆盖：`backend/src/domain`。
- [x] `T04` 完成后端引擎层注释覆盖：`backend/src/engine` + `backend/src/v3`。
- [x] `T05` 完成后端网关与记忆层注释覆盖：`backend/src/gateway` + `backend/src/memory`。
- [x] `T06` 完成后端服务与基础设施注释覆盖：`backend/src/{server,infra,config,scripts,utils}`。
- [x] `T07` 完成前端注释覆盖：`frontend/src`（含 composables/types/components 核心逻辑）。
- [x] `T08` 完成全仓库严格验收，并将结果写回发布检查链路。

## 3. 验收标准（任务映射）

- [x] `A01`（对应: `T01`） 执行 `npm run comment:report` 可输出 `scanned_files/scanned_exports/violations`。
- [x] `A02`（对应: `T02`） 执行 `node scripts/comment_coverage_check.js --strict --scope backend/src/app --scope backend/src/scenarios` 通过。
- [x] `A03`（对应: `T03`） 执行 `node scripts/comment_coverage_check.js --strict --scope backend/src/domain` 通过。
- [x] `A04`（对应: `T04`） 执行 `node scripts/comment_coverage_check.js --strict --scope backend/src/engine --scope backend/src/v3` 通过。
- [x] `A05`（对应: `T05`） 执行 `node scripts/comment_coverage_check.js --strict --scope backend/src/gateway --scope backend/src/memory` 通过。
- [x] `A06`（对应: `T06`） 执行 `node scripts/comment_coverage_check.js --strict --scope backend/src/server --scope backend/src/infra --scope backend/src/config --scope backend/src/scripts --scope backend/src/utils` 通过。
- [x] `A07`（对应: `T07`） 执行 `node scripts/comment_coverage_check.js --strict --scope frontend/src` 通过。
- [x] `A08`（对应: `T08`） 执行 `npm run comment:strict` 通过，且 `cd backend && npm run build:v3 && npm run test:quick` 与 `cd frontend && npm run build` 通过。

## 4. 全量人工审阅待办（代码文件）

说明：以下文件全部需要人工逐文件审阅并确认注释覆盖达标，未人工确认前一律保持未勾选。

- [x] `backend/src/app/bootstrap.ts`
- [x] `backend/src/app/container.ts`
- [x] `backend/src/app/index.ts`
- [x] `backend/src/config/index.ts`
- [x] `backend/src/domain/components/alive.ts`
- [x] `backend/src/domain/components/badge.ts`
- [x] `backend/src/domain/components/camp.ts`
- [x] `backend/src/domain/components/names.ts`
- [x] `backend/src/domain/components/role.ts`
- [x] `backend/src/domain/components/status_marks.ts`
- [x] `backend/src/domain/components/voting_right.ts`
- [x] `backend/src/domain/entities/player.ts`
- [x] `backend/src/domain/index.ts`
- [x] `backend/src/domain/model.ts`
- [x] `backend/src/domain/registries/condition_registry.ts`
- [x] `backend/src/domain/registries/phase_registry.ts`
- [x] `backend/src/domain/registries/role_registry.ts`
- [x] `backend/src/domain/systems/damage_resolution_system.ts`
- [x] `backend/src/domain/systems/win_condition_system.ts`
- [x] `backend/src/domain/world.ts`
- [x] `backend/src/engine/agent_broadcast_feed.ts`
- [x] `backend/src/engine/event_registry.ts`
- [x] `backend/src/engine/hooks/on_daybreak.ts`
- [x] `backend/src/engine/hooks/on_per_speech_gap.ts`
- [x] `backend/src/engine/hooks/on_pre_election.ts`
- [x] `backend/src/engine/hooks/on_pre_vote.ts`
- [x] `backend/src/engine/index.ts`
- [x] `backend/src/engine/phase_manager.ts`
- [x] `backend/src/engine/phase_pipeline/day_pipeline.ts`
- [x] `backend/src/engine/phase_pipeline/night_pipeline.ts`
- [x] `backend/src/engine/phase_pipeline/voting_pipeline.ts`
- [x] `backend/src/engine/sheriff_badge.ts`
- [x] `backend/src/gateway/action_validator.ts`
- [x] `backend/src/gateway/index.ts`
- [x] `backend/src/gateway/schemas/guard.schema.ts`
- [x] `backend/src/gateway/schemas/self_destruct.schema.ts`
- [x] `backend/src/gateway/schemas/shoot.schema.ts`
- [x] `backend/src/gateway/schemas/use_potion.schema.ts`
- [x] `backend/src/gateway/tool_gateway.ts`
- [x] `backend/src/index.ts`
- [x] `backend/src/infra/llm/openai_client.ts`
- [x] `backend/src/infra/llm/retry.ts`
- [x] `backend/src/infra/logger/game_logger.ts`
- [x] `backend/src/infra/transport/broadcaster.ts`
- [x] `backend/src/infra/transport/socket_server.ts`
- [x] `backend/src/memory/active_context_window.ts`
- [x] `backend/src/memory/index.ts`
- [x] `backend/src/memory/notebook_store.ts`
- [x] `backend/src/memory/prompt_assembler.ts`
- [x] `backend/src/memory/rolling_summary.ts`
- [x] `backend/src/run-test-v3.ts`
- [x] `backend/src/scenarios/index.ts`
- [x] `backend/src/scenarios/six_player_mvp.ts`
- [x] `backend/src/scenarios/twelve_player_standard.ts`
- [x] `backend/src/scripts/run_llm_dual.ts`
- [x] `backend/src/scripts/run_llm_game.ts`
- [x] `backend/src/scripts/run_mock_game.ts`
- [x] `backend/src/server/index.ts`
- [x] `backend/src/server/socket.ts`
- [x] `backend/src/server/v3_session_manager.ts`
- [x] `backend/src/server/view_mapper.ts`
- [x] `backend/src/utils/ansi.ts`
- [x] `backend/src/v3/action_providers.ts`
- [x] `backend/src/v3/index.ts`
- [x] `backend/src/v3/llm_action_provider.ts`
- [x] `frontend/src/App.vue`
- [x] `frontend/src/components/GameLog.vue`
- [x] `frontend/src/components/LogTerminal.vue`
- [x] `frontend/src/components/PlayerCard.vue`
- [x] `frontend/src/components/PlayerGrid.vue`
- [x] `frontend/src/components/TopBar.vue`
- [x] `frontend/src/components/ui/badge/Badge.vue`
- [x] `frontend/src/components/ui/badge/index.ts`
- [x] `frontend/src/components/ui/card/Card.vue`
- [x] `frontend/src/components/ui/card/CardContent.vue`
- [x] `frontend/src/components/ui/card/CardDescription.vue`
- [x] `frontend/src/components/ui/card/CardFooter.vue`
- [x] `frontend/src/components/ui/card/CardHeader.vue`
- [x] `frontend/src/components/ui/card/CardTitle.vue`
- [x] `frontend/src/components/ui/card/index.ts`
- [x] `frontend/src/components/ui/scroll-area/ScrollArea.vue`
- [x] `frontend/src/components/ui/scroll-area/index.ts`
- [x] `frontend/src/composables/mockDataEngine.ts`
- [x] `frontend/src/composables/mockGame.ts`
- [x] `frontend/src/composables/useGameStore.ts`
- [x] `frontend/src/composables/useWebSocket.ts`
- [x] `frontend/src/lib/utils.ts`
- [x] `frontend/src/main.ts`
- [x] `frontend/src/types/index.ts`
