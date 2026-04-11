# Debug Summary 可靠性与死亡触发上下文修复规范（V3）

## 背景

近期对局记录显示两类高频问题：

1. `debug_reports.json` 为空时，`debug_summary.md` 仍输出大量高优先级结论，导致误报。
2. 猎人死亡触发开枪时，玩家视角日志出现 `day=0 / phase=night / request_id=0-night-*` 等上下文错位信息。

这两类问题会直接降低复盘可用性与调试可信度。

## 目标

1. 当缺少结构化缺陷输入（`reports=[]`）时，`debug_summary` 禁止“自由推断式”问题输出。
2. 猎人开枪等“死亡触发动作”必须继承真实回合上下文（day/phase/stage）。
3. on_pre_vote 阶段在仅允许 `self_destruct` 时，提示词需要增强约束表达，降低非法工具调用概率。

## 范围

- `backend/src/session_recording/debug_summary_pipeline.ts`
- `backend/src/engine/phase_manager.ts`
- `backend/src/agents/llm/llm_action_provider.ts`
- `backend/tests/v3/session_recording.test.ts`
- `backend/tests/v3/phase_manager_mvp.test.ts`
- `backend/tests/v3/llm_action_provider.test.ts`

## 设计

### A. Debug Summary 证据门禁

#### A1. 空报告硬门禁

当 `debug_reports.json.reports.length === 0` 时：

- 不再执行并行子 agent 汇总；
- 不再调用 LLM 生成 Findings/TODO；
- 输出“无结构化问题输入”的确定性摘要模板。

#### A2. 确定性检查（替代自由推断）

空报告场景下仅允许输出以下自动检查结果：

- 是否存在 `player timeline` 元数据异常（例如 `day<=0`、`request_id` 与 day/phase 不一致）。
- 统计信息（session、时长、事件总数、玩家视角条目总数）。

异常条目需带明确 evidence（seq + player_id）。

### B. 猎人开枪上下文修复

死亡钩子触发 `onHunterShoot` 时，构建 ActionRequest 必须：

- `context.day = 当前 state.day`
- `phase = 当前 state.phase`（通常为白天结算窗口）
- `context.phase = "hunter_shot"`（用于 stage 记录）

禁止继续使用缺省值，避免 session 记录回落到 `day=0`。

### C. on_pre_vote 约束提示增强

当请求位于 `on_pre_vote` 且仅允许 `self_destruct`（以及可选 `report_bug`）时：

- 在阶段上下文提示中加入明确文案：本轮禁止发言、禁止投票、禁止其他工具；
- 目标是降低非法工具尝试率，不改变“可跳过行动”的规则语义。

## 验收标准

1. `reports=[]` 的 session，`debug_summary.md` 不出现无证据 High/Medium 结论。
2. 猎人开枪对应玩家 timeline 中，`day>0` 且阶段与触发场景一致，不再出现 `0-night-*`。
3. `on_pre_vote` 场景的用户提示文本含“仅可 self_destruct/report_bug”约束语句。
4. 相关测试全部通过。

## 回归测试计划

1. `session_recording.test.ts`
   - 新增：`reports=[]` 时仅输出确定性摘要，不输出 hallucinated findings。
   - 新增：检测 request_id/day 元数据异常会进入 deterministic findings。
2. `phase_manager_mvp.test.ts`
   - 新增：猎人开枪请求上下文包含真实 day 与 `hunter_shot` stage 标识。
3. `llm_action_provider.test.ts`
   - 新增：`on_pre_vote + self_destruct` 场景，用户提示包含强约束文案。

