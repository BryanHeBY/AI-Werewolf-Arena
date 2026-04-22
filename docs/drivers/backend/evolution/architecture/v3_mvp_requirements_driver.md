# V3 MVP Requirements 开发驱动

来源规范：`docs/specs/backend/evolution/architecture/v3_mvp_requirements.md`

## 任务
- [x] `MV01` 完成核心 ECS 组件（Role/Camp/Alive/VotingRight/StatusMarks）。
- [x] `MV02` 完成夜晚/白天/投票流程控制与夜间流水线。
- [x] `MV03` 完成结算系统与中断钩子（白痴/猎人/自爆）。
- [x] `MV04` 完成 prompt 装配、tool schema 注册与错误反弹机制。
- [x] `MV05` 完成 6 人/12 人核心回归测试。

## 验收
- [x] `MA01` 6 人局可稳定闭环。
- [x] `MA02` 关键角色机制（白痴/猎人/自爆）可复现。
- [x] `MA03` 工具调用链稳定，第三天后上下文仍可控。

## 验收证据
1. ECS 组件：`backend/src/core/domain/components/{role,camp,alive,voting_right,status_marks}.ts`
2. 时序与流水线：`backend/src/game/engine/phase_manager.ts`、`backend/src/game/engine/phase_pipeline/{night,day,voting}_pipeline.ts`
3. 中断与钩子：`backend/src/game/mechanisms/roles/{idiot,hunter,wolf}/**`（含 `self_destruct` / `hunter_shot` / `idiot_revealed`）
4. Prompt/Tool 链路：`backend/src/ai/agents/llm/llm_action_provider.ts`、`backend/src/game/mechanisms/registries/tool_spec_registry.ts`
5. 运行证据：`cd backend && npm run smoke:v3`（通过，输出 `game_over` 快照）
6. 回归测试：
   - `cd backend && npx jest tests/v3/phase_manager_mvp.test.ts --runInBand`（9/9）
   - `cd backend && npx jest tests/v3/tool_gateway_validation.test.ts --runInBand`（3/3）
   - `cd backend && npx jest tests/v3/llm_context_window_stability.test.ts --runInBand`（1/1，验证多日多轮后 prompt 窗口仍受控）
