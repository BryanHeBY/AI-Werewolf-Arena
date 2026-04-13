# V3 白皮书索引

## 1. 当前代码详细文档

本目录包含 V3 重构阶段的核心白皮书与实现要求：

1. 后端架构总规范（最高优先级 Source of Truth）：`backend_architecture_whitepaper_v3.md`
2. MVP 版型实现要求（首批落地任务清单）：`v3_mvp_requirements.md`
3. 技术白皮书（通用架构说明）：`technical_whitepaper_v3.md`
4. 玩法白皮书（全角色规则词典）：`gameplay_whitepaper_v3.md`
5. Session 复盘记录规范（对局落盘与前端复盘协议）：`session_replay_recording_v3.md`
6. 引擎与玩法机制解耦重构方案（已归档）：`archive/completed_todos/engine_mechanism_decoupling_refactor_v3.md`
7. LLM 自动调试一期规范（已归档）：`archive/completed_todos/llm_auto_debug_phase1_spec.md`
8. LLM 自动调试二期规范：`llm_auto_debug_phase2_spec.md`
9. 运行时配置文件规范：`runtime_config_spec.md`
10. Session 实时复盘记录规范（已归档）：`archive/completed_todos/realtime_session_records_spec.md`
11. LLM 行动提示三行高密度规范：`llm_user_prompt_three_line_spec.md`
12. Multi-Tool 回合与 Turn Constraints 重构 TODO（已归档）：`archive/multi_tool_turn_constraints_refactor_todo_v3.md`
13. 广播信息结构规范：`broadcast_message_structure_spec.md`

阅读建议：

1. 先读 `backend_architecture_whitepaper_v3.md`（后端开发最高指导）。
2. 再读 `v3_mvp_requirements.md`（当前迭代的实现清单与验收门槛）。
3. 再读技术白皮书与玩法白皮书（扩展机制与全量规则）。
4. 编码时同步参考：`backend/src/*` 与 `frontend/src/*` 的源码中文注释。

## 2. 开发任务清单

- [ ] `T01` 在 `backend/src/runtime/config/index.ts` 与 `backend/src/runtime/scenarios/*.ts` 落地可执行配置结构（角色、阶段、钩子、胜负条件）。
- [ ] `T02` 在 `backend/src/ai/agents/providers/action_providers.ts` 落地技能接口标准化（触发-目标-冲突-结算）。
- [ ] `T03` 在 `backend/src/core/domain/components/*` 建立角色到 ECS 组件映射并补齐导出。
- [ ] `T04` 将 MVP Checklist 落地为 `backend/tests/v3/*` 的可执行回归用例。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） 场景配置可直接驱动 phase 运行，不依赖硬编码流程分支。
- [ ] `A02`（对应: `T02`） 技能调用经网关校验后可稳定返回结构化结果，无自由文本解析依赖。
- [ ] `A03`（对应: `T03`） 角色映射可从组件层直接追溯到技能执行与结算。
- [ ] `A04`（对应: `T04`） MVP 关键规则在自动化测试中全部可复现。
