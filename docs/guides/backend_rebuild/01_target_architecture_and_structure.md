# backend target architecture and structure

## 1. 当前代码详细文档

本文给出 V3 后端目标目录结构、模块职责、以及与 V2 文件的迁移映射。该结构将作为“重构落地蓝图”。

V3 目标目录（建议）：

```text
backend/src
├── app
│   ├── bootstrap.ts
│   └── container.ts
├── domain
│   ├── entities
│   │   └── player.ts
│   ├── components
│   │   ├── role.ts
│   │   ├── camp.ts
│   │   ├── alive.ts
│   │   ├── voting_right.ts
│   │   └── status_marks.ts
│   ├── systems
│   │   ├── damage_resolution_system.ts
│   │   └── win_condition_system.ts
│   └── registries
│       ├── role_registry.ts
│       ├── phase_registry.ts
│       └── condition_registry.ts
├── engine
│   ├── phase_manager.ts
│   ├── phase_pipeline
│   │   ├── day_pipeline.ts
│   │   ├── night_pipeline.ts
│   │   └── voting_pipeline.ts
│   ├── hooks
│   │   ├── on_daybreak.ts
│   │   ├── on_pre_election.ts
│   │   ├── on_pre_vote.ts
│   │   └── on_per_speech_gap.ts
│   └── event_registry.ts
├── gateway
│   ├── tool_gateway.ts
│   ├── schemas
│   │   ├── guard.schema.ts
│   │   ├── use_potion.schema.ts
│   │   ├── shoot.schema.ts
│   │   └── self_destruct.schema.ts
│   └── action_validator.ts
├── memory
│   ├── prompt_assembler.ts
│   ├── notebook_store.ts
│   ├── rolling_summary.ts
│   └── active_context_window.ts
├── infra
│   ├── llm
│   │   ├── openai_client.ts
│   │   └── retry.ts
│   ├── transport
│   │   ├── socket_server.ts
│   │   └── broadcaster.ts
│   └── logger
│       └── game_logger.ts
├── scenarios
│   ├── six_player_mvp.ts
│   └── twelve_player_standard.ts
└── index.ts
```

V2 -> V3 迁移映射（第一版）：

1. `core/GameEngineV2.ts` -> `engine/phase_manager.ts` + `engine/phase_pipeline/*`
2. `core/EventBus.ts` -> `engine/event_registry.ts`
3. `core/GameFactoryV2.ts` -> `app/bootstrap.ts` + `domain/registries/*`
4. `core/Environment.ts` -> `memory/*` + `engine/*` 的上下文状态载体
5. `ecs/*` -> `domain/entities|components|systems`
6. `agent/ActionValidator.ts` -> `gateway/action_validator.ts`
7. `agent/PromptPipeline.ts` -> `memory/prompt_assembler.ts`
8. `llm/*` -> `infra/llm/*`
9. `server/*` + `broadcaster/*` -> `infra/transport/*`
10. `logger/GameLogger.ts` -> `infra/logger/game_logger.ts`

V2 -> V3 迁移方式说明：

1. `core/GameEngineV2.ts` -> `engine/phase_manager.ts` + `engine/phase_pipeline/*`：直接重写（按串行 phase pipeline 重建）。
2. `core/EventBus.ts` -> `engine/event_registry.ts`：复制改造（保留事件分发思想，改为强类型注册接口）。
3. `core/GameFactoryV2.ts` -> `app/bootstrap.ts` + `domain/registries/*`：直接重写（拆分工厂职责到容器和注册表）。
4. `core/Environment.ts` -> `memory/*` + `engine/*`：直接重写（拆为上下文窗口、摘要、笔记等分层）。
5. `ecs/*` -> `domain/entities|components|systems`：复制改造（保留 ECS 思路，规范组件与系统边界）。
6. `agent/ActionValidator.ts` -> `gateway/action_validator.ts`：复制改造（规则迁移并扩展为统一网关校验）。
7. `agent/PromptPipeline.ts` -> `memory/prompt_assembler.ts`：复制改造（保留提示词组装，增强分层记忆输入）。
8. `llm/*` -> `infra/llm/*`：弃用（当前基线先以 mock/适配层驱动，后续按 provider 重建）。
9. `server/*` + `broadcaster/*` -> `infra/transport/*`：复制改造（保留 transport 能力并统一事件协议）。
10. `logger/GameLogger.ts` -> `infra/logger/game_logger.ts`：复制改造（日志能力迁移并对齐 V3 字段）。

V2 -> V3 对照链接：

1. 对照入口：`docs/guides/backend_rebuild/01_target_architecture_and_structure.md`
2. backend 代码入口：`backend/src/index.ts`

目录约束：

1. `domain` 禁止依赖 `infra`。
2. `engine` 可依赖 `domain`，禁止直接依赖具体 LLM SDK。
3. `gateway` 只做鉴权与 schema，不直接执行业务结算。
4. `infra` 不允许包含游戏规则判断。

必须暴露接口清单（当前 V3 代码基线）：

1. `app`
   - `bootstrap.ts`: `createV3Runtime()`
   - `container.ts`: `createRuntimeContainer()`
2. `config`
   - `index.ts`: `loadV3Config()`
3. `domain`
   - `model.ts`: 核心类型导出（实体、组件、事件、动作意图）。
   - `world.ts`: `createInitialWorld()`, `cloneWorld()`
4. `engine`
   - `phase_manager.ts`: `runNightPhase()`, `runDayPhase()`, `runVotingPhase()`
   - `event_registry.ts`: `createEventRegistry()`, `emitEvent()`, `registerHandler()`
5. `gateway`
   - `tool_gateway.ts`: `createToolGateway()`, `dispatchToolCall()`
   - `action_validator.ts`: `validateAction()`
6. `memory`
   - `prompt_assembler.ts`: `assemblePromptContext()`
   - `rolling_summary.ts`: `updateRollingSummary()`
   - `notebook_store.ts`: `appendNotebookEntry()`, `readNotebookEntries()`
   - `active_context_window.ts`: `appendActiveContext()`, `trimActiveContext()`
7. `scenarios`
   - `six_player_mvp.ts`: `buildSixPlayerMvpScenario()`
   - `twelve_player_standard.ts`: `buildTwelvePlayerStandardScenario()`
8. `server`
   - `index.ts`: `startServer()`
   - `socket.ts`: `createSocketServer()`
   - `v3_session_manager.ts`: `createV3SessionManager()`
   - `view_mapper.ts`: `mapWorldToClientView()`
9. `v3`
   - `action_providers.ts`: `createActionProviders()`

## 2. 开发任务清单

- [ ] `T01` 将 `backend/src/domain/model.ts` 中 MVP 组件定义拆分到 `backend/src/domain/components/*` 并保持 `model.ts` 仅作为聚合导出。
- [ ] `T02` 将 `backend/src/engine/hooks/*` 从文档蓝图落地为真实代码模块，并由 `backend/src/engine/phase_manager.ts` 统一调度调用。
- [ ] `T03` 完成 `backend/src/server/*` 与 `backend/src/infra/transport/*` 的职责收敛：server 只做会话/路由，transport 只做消息发送与协议适配。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） `backend/src/domain/components/*` 组件实现与源码注释可直接定位职责。
- [ ] `A02`（对应: `T02`） `backend/tests/v3/phase_manager_mvp.test.ts` 外新增 hooks 调度断言，覆盖 4 个 hook 调用顺序。
- [ ] `A03`（对应: `T03`） `backend/tests/v3/session_manager.test.ts` 通过且 `server` 模块不再直接依赖低层 transport 细节实现。
