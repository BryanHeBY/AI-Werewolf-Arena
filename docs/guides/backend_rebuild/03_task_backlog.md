# backend task backlog

## 1. 当前代码详细文档

本文是 V3 后端重构执行看板，采用“模块任务 + 验收任务”方式管理。

任务分组 A：目录与基础设施

- [ ] A1 新建 V3 目录骨架（app/domain/engine/gateway/memory/infra/scenarios）。
- [ ] A2 新建统一导出入口 `backend/src/index.ts`。
- [ ] A3 新建依赖方向约束说明（禁止跨层反向依赖）。

任务分组 B：ECS 与系统

- [ ] B1 `RoleComponent` / `CampComponent` / `AliveComponent` / `VotingRightComponent`。
- [ ] B2 `StatusMarks`：`GuardMark` / `WolfKillMark` / `HealMark` / `PoisonMark`。
- [ ] B3 `DamageResolutionSystem`：同守同救规则、毒药致死规则。
- [ ] B4 `WinConditionSystem`：屠城/屠边判定。

任务分组 C：Phase 与事件拦截

- [ ] C1 `PhaseManager`：`start_night()`、`start_day()`、`start_voting()`。
- [ ] C2 夜间流水线：狼人交流 -> 守卫 -> 狼刀 -> 女巫 -> 预言家。
- [ ] C3 `EventRegistry`：白痴被放逐免死 + 剥离投票权。
- [ ] C4 `EventRegistry`：猎人吃毒闷枪/合法死亡触发 `shoot(target_id)`。
- [ ] C5 自爆中断：`self_destruct(reason)` 触发 `jump_to("night")`。

任务分组 D：Tool Gateway 与 Prompt

- [ ] D1 Tool schema 注册：`guard`、`check_identity`、`use_potion`、`shoot`、`self_destruct`。
- [ ] D2 网关鉴权：同守限制、女巫自救拦截、同夜双药拦截。
- [ ] D3 Prompt 组装：system facts + notebook + summary + active context。
- [ ] D4 输入清洗：拦截伪造系统前缀（上帝/法官等）。

任务分组 E：场景与联调

- [ ] E1 6 人局基准场景配置与回放脚本。
- [ ] E2 12 人局基准场景配置与回放脚本。
- [ ] E3 socket/broadcast 协议对齐与前端联调。
- [ ] E4 服务入口切换到 V3（`server/index.ts`）。
- [ ] E5 清理 V2 目录与旧测试，完成单栈运行。

建议执行序列：

1. A -> B -> C -> D -> E。
2. B 与 C 可部分并行，但 `DamageResolutionSystem` 先于复杂事件拦截。
3. E 仅在 C/D 出口通过后进入。

当前阻塞（2026-04-08）：

1. 无 P0-P4 阶段阻塞，当前阻塞转为“白皮书全角色覆盖”与“高级机制扩展”。

任务责任路径与提交规模（首版）：

| 任务 | 责任文件路径 | 预计提交数 |
| --- | --- | --- |
| A1 | `backend/src/{app,domain,engine,gateway,memory,infra,scenarios}` + 对应源码注释 | 1-2 |
| A2 | `backend/src/index.ts` + 相关入口源码注释 | 1 |
| A3 | `docs/guides/backend_rebuild/06_dependency_rules.md` + `backend/.eslintrc*`（或等价规则配置） | 1 |
| B1 | `backend/src/domain/model.ts` + `backend/src/domain/world.ts` | 1-2 |
| B2 | `backend/src/domain/model.ts` + `backend/src/domain/world.ts` | 1 |
| B3 | `backend/src/engine/phase_pipeline/night_pipeline.ts` + `backend/src/domain/world.ts` | 1-2 |
| B4 | `backend/src/engine/phase_manager.ts` + `backend/src/domain/world.ts` | 1 |
| C1 | `backend/src/engine/phase_manager.ts` | 1 |
| C2 | `backend/src/engine/phase_pipeline/night_pipeline.ts` | 1-2 |
| C3 | `backend/src/engine/event_registry.ts` + `backend/src/engine/phase_pipeline/voting_pipeline.ts` | 1 |
| C4 | `backend/src/engine/event_registry.ts` + `backend/src/v3/action_providers.ts` | 1 |
| C5 | `backend/src/engine/phase_pipeline/day_pipeline.ts` + `backend/src/engine/phase_manager.ts` | 1 |
| D1 | `backend/src/gateway/tool_gateway.ts` + `backend/src/v3/action_providers.ts` | 1 |
| D2 | `backend/src/gateway/action_validator.ts` | 1 |
| D3 | `backend/src/memory/prompt_assembler.ts` + `backend/src/memory/rolling_summary.ts` | 1-2 |
| D4 | `backend/src/gateway/tool_gateway.ts` | 1 |
| E1 | `backend/src/scenarios/six_player_mvp.ts` + `backend/tests/v3/*` | 1 |
| E2 | `backend/src/scenarios/twelve_player_standard.ts` + `backend/tests/v3/*` | 1 |
| E3 | `backend/src/server/socket.ts` + `backend/src/server/view_mapper.ts` | 1-2 |
| E4 | `backend/src/server/index.ts` + `backend/src/index.ts` | 1 |
| E5 | `backend/src/core/*`（已删除） + `backend/tests/*`（迁移） + 清理提交记录 | 1 |

任务阻塞与并行标签（首版）：

| 任务 | 阻塞项 | 可并行项 |
| --- | --- | --- |
| A1 | 无 | A2 |
| A2 | A1 | A3 |
| A3 | A1 | B1 |
| B1 | A1-A3 | B2 |
| B2 | B1 | C1 |
| B3 | B1-B2 | D1 |
| B4 | B1-B3 | C1 |
| C1 | B1-B4 | C2 |
| C2 | C1 | D1 |
| C3 | C1 | C4 |
| C4 | C1 | C5 |
| C5 | C1-C4 | D2 |
| D1 | C1-C2 | D3 |
| D2 | D1 | D3 |
| D3 | D1-D2 | D4 |
| D4 | D1-D3 | E1 |
| E1 | C3-C5 + D1-D4 | E2 |
| E2 | E1 | E3 |
| E3 | E1-E2 | E4 |
| E4 | E3 | E5 |
| E5 | E4 | 无 |

任务回归用例编号（首版）：

| 用例编号 | 测试文件 | 关联任务 |
| --- | --- | --- |
| TC-PHASE-001 | `backend/tests/v3/phase_manager_mvp.test.ts` | C1, C2, B3, B4, E1, E2 |
| TC-GATEWAY-001 | `backend/tests/v3/tool_gateway_validation.test.ts` | D1, D2, D4 |
| TC-EVENT-001 | `backend/tests/v3/event_registry_hooks.test.ts` | C3, C4, C5 |
| TC-SESSION-001 | `backend/tests/v3/session_manager.test.ts` | E3, E4 |

MVP 必选机制覆盖矩阵（对齐 `docs/specs/v3_mvp_requirements.md`）：

| MVP 要求 | 任务映射 | 测试映射 |
| --- | --- | --- |
| ECS 组件（Role/Camp/Alive/Voting/Marks） | B1, B2 | TC-PHASE-001 |
| 流程控制（night/day/voting） | C1, C2 | TC-PHASE-001 |
| 结算系统（同守同救、毒药致死） | B3 | TC-PHASE-001 |
| 事件拦截（白痴/猎人/自爆） | C3, C4, C5 | TC-EVENT-001 |
| Tool schema + 鉴权 + 错误回弹 | D1, D2 | TC-GATEWAY-001 |
| Prompt 与记忆（发言挂载、摘要） | D3 | TC-PHASE-001 |
| 场景与联调（6人/12人/API） | E1, E2, E3, E4 | TC-SESSION-001 |

发布异常转化记录（用于对齐 `review_release_activity_driver.md`）：

- [ ] R1 `release:check` 缺少标准命令编排，已补 `backend/package.json`：`test:quick` / `test:full` / `smoke:v3` / `release:check`。
- [ ] R2 缺少依赖方向阻断命令，已补 `backend/eslint.config.cjs` 与 `npm run lint:deps`。

## 2. 开发任务清单

- [ ] `T01` 任务组 F：实现狼队战术环与夜间并行角色结算优先级（守卫 > 狼人 > 女巫 > 预言家）。
- [ ] `T02` 任务组 G：实现警长系统（竞选、退水、1.5 票、移交/撕毁、定序权）。
- [ ] `T03` 任务组 H：实现中断钩子全配置（天亮/警上/放逐前/逐发言间隙）与自爆劫持协议。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） `backend/tests/v3/night_wolf_tactical_loop.test.ts` 与结算优先级断言通过。
- [ ] `A02`（对应: `T02`） `backend/tests/v3/sheriff_pipeline.test.ts` 覆盖竞选与票权链路且通过。
- [ ] `A03`（对应: `T03`） `backend/tests/v3/day_interrupt_hooks.test.ts` 覆盖 4 类窗口与自爆跳夜行为且通过。
