# Multi-Tool 回合与 Turn Constraints 重构 TODO（V3）

## 1. 目标

将当前“单回合单主动作 + mustAct 布尔控制”的执行链路，升级为：

1. 单回合可多次工具交互，服务端逐次回填结果；
2. Agent 显式 `finish_turn` 决定回合结束；
3. 使用结构化 Turn Constraints 替代 `mustAct`；
4. 行动校验从 loop 主流程中解耦为独立服务。

## 2. 任务清单

- [x] `D00` 执行前先落实“机制就地解耦”约束：
  - 与角色强绑定的规则放在对应 role 目录（如 `backend/src/mechanisms/roles/*`）；
  - 与上警/警长强绑定的规则放在 sheriff 机制目录（如 `backend/src/mechanisms/sheriff/*`）；
  - `engine` 与 `llm_action_provider` 仅保留编排与通用接口，不落地具体角色/警长业务判断。
- [x] `D01` 约束实现拆分为两层：
  - 约束判定层（纯逻辑，可测试、无文案）；
  - 约束渲染层（提示文本组装，可按角色/机制定制）。
- [x] `T01` 新增 `TurnConstraints` 领域结构（required/selection/cardinality/end_condition/retry_policy）并在 `ActionRequest.context` 中透传。
- [x] `T02` 在 `PhaseManager` 与各 phase pipeline 中，用结构化约束替代 `must_act` 写入逻辑。
- [x] `T03` 扩展 SDK tool loop：支持同回合多工具调用，显式 `finish_turn` 前不自动结束。
- [x] `T04` 引入 `ActionValidationService`（或等价命名）并迁移以下校验：
  - 工具可用性与阶段窗口；
  - 参数合法性与目标可选集合；
  - 回合结束前约束满足性（含必需动作检查）。
- [x] `T05` 实现“结束前拦截”：当 Agent 调用 `finish_turn` 但约束未满足时，向消息流注入重试提示并继续同回合。
- [x] `T06` 明确“多工具但主动作次数”策略（默认建议：单回合最多 1 次状态变更主动作，查询类工具可多次）。
- [x] `T07` 更新复盘记录结构，区分：
  - 回合内多次 tool_call 序列；
  - 约束未满足导致的继续对话；
  - 真正结束回合的终点事件。
- [x] `T08` 补全文档：
  - `docs/specs/runtime_config_spec.md`（新增约束配置说明）；
  - `docs/specs/realtime_session_records_spec.md`（新增回合内多工具记录规范）；
  - `docs/modules/backend_overview.md`（执行模型更新）。

## 3. 验收标准

- [x] `A00`（对应: `D00/D01`） 新增逻辑同时满足：1) 代码位置符合“角色/机制就地落位”；2) 约束判定与渲染代码已分层，单测可独立验证判定层。
- [x] `A01`（对应: `T01/T02`） `build:v3` 通过，且 `mustAct` 仅作为兼容字段存在，不再是核心判定源。
- [x] `A02`（对应: `T03`） 新增测试验证：同一回合可连续调用多个工具并逐次获得结果。
- [x] `A03`（对应: `T04`） 新增测试验证：工具校验逻辑通过 `ActionValidationService` 统一入口执行。
- [x] `A04`（对应: `T05`） 新增测试验证：`finish_turn` 时若未满足约束，会收到重试提示并继续当前回合。
- [x] `A05`（对应: `T06`） 新增测试验证：主动作次数限制生效，超限会返回结构化拒绝结果。
- [x] `A06`（对应: `T07`） 新生成 player 视角与 debug 记录可还原“回合内多工具对话”全过程。
- [x] `A07`（对应: `T08`） 相关规范文档更新完成且与实现一致。

## 4. 建议测试文件

1. `backend/tests/v3/llm_action_provider.test.ts`
2. `backend/tests/v3/tool_gateway_validation.test.ts`
3. `backend/tests/v3/phase_manager_mvp.test.ts`
4. `backend/tests/v3/night_wolf_tactical_loop.test.ts`
5. `backend/tests/v3/session_recording.test.ts`
