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

目录约束：

1. `domain` 禁止依赖 `infra`。
2. `engine` 可依赖 `domain`，禁止直接依赖具体 LLM SDK。
3. `gateway` 只做鉴权与 schema，不直接执行业务结算。
4. `infra` 不允许包含游戏规则判断。

## 2. 未来目标 TODO

- [ ] 为每个目标目录补充“必须暴露接口”清单。
- [ ] 为每个迁移映射补充“迁移方式”（复制改造/直接重写/弃用）。
- [ ] 在 `docs/codebase/backend` 中增加 V2->V3 文件对照链接。

## 3. 验收标准

- [ ] 后端重构后的目录结构与本文蓝图一致，偏差有文档记录。
- [ ] 每个旧模块都能映射到新的责任模块，不出现无主逻辑。
- [ ] 模块依赖方向满足约束，不出现跨层反向依赖。
