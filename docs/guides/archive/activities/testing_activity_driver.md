# testing activity driver

## 1. 当前代码详细文档

本文件定义 V3 阶段测试活动驱动，目标是先保证“规则正确”，再扩展“博弈表现”。

测试分层：

1. 规则单测（优先级最高）
   - 组件与系统级：ECS 组件挂载、印记冲突、胜负判定。
   - 网关级：非法 tool call 拦截与错误回弹。
2. 流程集成测试
   - 6 人局闭环（暗牌、无警长、屠城）。
   - 12 人局机制链（警长、白痴、猎人、狼人自爆中断）。
3. 端到端联调测试
   - socket 事件收发一致性。
   - 前端状态机与后端广播协议一致性。

必测场景（MVP）：

1. 守卫同守拦截（不可连续守同一人）。
2. 女巫不可自救 + 同夜不可双药。
3. 白痴被放逐翻牌免死并失去投票权。
4. 猎人吃毒闷枪、非毒死可触发 `shoot(target_id)`。
5. 狼人 `self_destruct(reason)` 在合法窗口打断白天并跳夜。

执行策略：

1. 先用 Mock LLM 覆盖状态流转正确性。
2. 再接入真实模型做 tool call 约束验证（使用项目根目录 `.env` 中 `OPENAI_BASE_URL/OPENAI_API_KEY/OPENAI_MODEL`，当前由 Minimax 配置提供）。
3. 每次规则修改必须更新对应测试用例与文档条目。

当前自动化结果（2026-04-08）：

1. 已通过：`backend/tests/v3/tool_gateway_validation.test.ts`
2. 已通过：`backend/tests/v3/event_registry_hooks.test.ts`
3. 已通过：`backend/tests/v3/phase_manager_mvp.test.ts`
4. 已通过：`backend/tests/v3/session_manager.test.ts`
5. 执行命令：`cd backend && npm test -- --runInBand`

## 2. 开发任务清单

- [x] `T01` 新增 `backend/tests/v3/night_wolf_tactical_loop.test.ts` 覆盖夜间狼人战术环流程。
- [x] `T02` 新增 `backend/tests/v3/day_interrupt_hooks.test.ts` 覆盖白天 4 类中断窗口。
- [x] `T03` 新增 `backend/tests/v3/sheriff_pipeline.test.ts` 覆盖警长竞选、票权、移交/撕毁。
- [x] `T04` 新增 `backend/tests/v3/memory_compression.test.ts` 覆盖摘要触发与上下文替换行为。
- [x] `T05` 新增 `backend/tests/v3/minimax_live_connectivity.test.ts`，验证真实模型连通与最小 tool call 回路（通过 `RUN_LIVE_LLM_TEST=1` 显式启用，默认不在常规回归中执行）。

## 3. 验收标准（任务映射）

- [x] `A01`（对应: `T01`） 夜间狼人战术环在随机顺序下仍可稳定重放通过。
- [x] `A02`（对应: `T02`） 任一中断窗口触发后，阶段流转与日志断言均正确。
- [x] `A03`（对应: `T03`） 警长相关规则测试通过且不影响现有 MVP 用例。
- [x] `A04`（对应: `T04`） 第 3 天后上下文压缩逻辑可验证且无流程中断。
- [x] `A05`（对应: `T05`） 在配置有效时执行 `cd backend && RUN_LIVE_LLM_TEST=1 npm test -- --runInBand tests/v3/minimax_live_connectivity.test.ts` 通过；配置缺失时测试必须以明确原因 `skip`，且全程不打印 API Key 明文。
