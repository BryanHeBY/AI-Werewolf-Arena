# Broadcast Message Structure Spec (V3)

## 1. 目标

定义 V3 引擎“广播信息结构”的统一规范，覆盖：

1. 玩家视角广播（`broadcast_feed` / `player_x.json` 的 `broadcast` 条目）
2. 终端 live 广播（`[live]...`）
3. 实时推送广播（`RealtimeGameEvent` + visibility）

本规范用于保证：

1. 同类事件在不同通道中的语义一致；
2. 公开信息与私有信息边界稳定；
3. 广播文案可扩展（注册式翻译）且可回归测试。

---

## 2. 通道与职责

### 2.1 玩家视角广播（Agent Feed）

- 入口：`buildAgentBroadcastFeed` / `buildAgentBroadcastLine`
- 渲染注册：`AgentEventLineRegistry`
- 用途：作为 LLM 回合前的可见上下文、以及 `player_x.json` 的广播时间线。

### 2.2 终端 live 广播

- 入口：`ScriptEventRenderRegistry.toLiveRender`
- 用途：CLI 运行期可读日志。
- 特点：按 `kind`（`god/chat/system/action/private`）做视觉分组，但文本标签仍以 `[live][...]` 为准。

### 2.3 实时推送广播（Socket）

- 入口：`RealtimeEventRegistry.translate`
- 结构：`{ type, data, visibility }`
- visibility：
  - `public`
  - `wolves_only`
  - `private_targets`

---

## 3. 可见性规则（当前实现）

### 3.1 公开广播

全体可见：

1. `phase_changed`（阶段切换）
2. `night_resolved`（昨夜死亡/平安夜）
3. `voted_out`（放逐结果）
4. `game_over`（胜利阵营+原因）
5. 猎人开枪、白痴翻牌、遗言授权与遗言内容等公共事件
6. 警长汇总事件：上警汇总、退水汇总、警长票型汇总、警徽流转

### 3.2 阵营私有广播

仅狼人可见：

1. `wolf_discussion`
2. `wolf_discussion_ended`
3. `wolf_tactical_order`
4. `wolf_kill_vote_cast`

### 3.3 个人私有广播

仅行动者本人可见：

1. `seer_checked`
2. `guard_applied`
3. `witch_potion_used` / `witch_potion_skipped`
4. `vote_cast`（普通放逐投票逐票）
5. `sheriff_vote_cast`（警长投票逐票）
6. `sheriff_candidate_declared`（上警/退水逐条）

---

## 4. 结构化文案规范（live）

### 4.1 总体约定

1. 上帝流程播报统一使用 `[live][上帝]...`。
2. 遗言使用专用通道：`[live][遗言][x] ...`。
3. 终局使用上帝终局通道：`[live][上帝][终局] ...`。
4. 行动结果优先表达“语义”，避免只输出枚举码（例如 `heal/poison` 需翻译成中文）。
5. 除开局 `[上帝私有]` 外，广播标签不使用 `[私有]` 字样；是否“私有可见”由可见性规则决定。
6. 广播文案避免第二人称“你”，统一使用玩家编号叙述（如 `3号...`）。

### 4.2 关键示例

1. 狼人夜聊顺序：
   - `[live][上帝] 狼人开始夜聊讨论，顺序：5->3`
2. 遗言：
   - `[live][遗言][6] 我是预言家...`
3. 终局：
   - `[live][上帝][终局] 胜利阵营=狼人 原因=狼人达半`
4. 警长汇总：
   - `[live][上帝][上警] 现在开始竞选警长...`
   - `[live][上帝][警长投票] 警长投票票型：...`

---

## 5. 投票类事件的“双轨输出”规范

### 5.1 普通放逐投票（`vote_cast`）

1. 逐票：仅投票者可见（`[行动][投票] x号投给y号` / `x号弃票`）
2. 汇总：公开票型（`放逐票型：...`）
3. live 输出：保留逐条行动 + 上帝票型汇总两条线。

### 5.2 警长投票（`sheriff_vote_cast`）

1. 逐票：仅投票者可见（`[行动][警长投票] x号...`）
2. 汇总：公开警长票型（`sheriff_vote_summary`）
3. live 输出：保留逐条行动 + 上帝票型汇总。

### 5.3 上警/退水（`sheriff_candidate_declared`）

1. 逐条：仅行动者可见（`[行动][上警] x号...`）
2. 汇总：公开名单与退水汇总（`sheriff_nomination_summary` / `sheriff_withdraw_summary`）
3. live 输出：默认不打印逐条上警/退水动作，仅打印汇总。

---

## 6. 文案本地化（注册机制）

采用“机制内定义 + 中央注册”：

1. 注册表：`backend/src/mechanisms/shared/text_localization_registry.ts`
2. 角色翻译贡献：`backend/src/mechanisms/roles/text_localization.ts`
3. 女巫药剂翻译贡献：`backend/src/mechanisms/roles/witch/text_localization.ts`
4. 终局胜负翻译贡献：`backend/src/mechanisms/win_conditions/text_localization.ts`

要求：

1. 翻译逻辑不得散落在流程代码中硬编码；
2. 新角色/新机制新增术语时，优先在对应机制目录贡献词条；
3. 渲染层只消费注册表接口（如 `winnerName`、`potionType`）。

---

## 7. 与复盘落盘的关系

`player_x.json` 采用扁平时间线：

1. `kind="broadcast"`：记录该玩家可见广播增量
2. `kind="turn"`：记录该回合 `delta_messages`

投票类私有逐条广播也应进入对应玩家的 `broadcast` 时间线，不应丢失。

---

## 8. 验收与回归建议

至少覆盖以下自动化检查：

1. `vote_cast`：
   - 投票者可见逐条行动广播；
   - 非投票者不可见该逐票行动；
   - 所有人可见放逐票型汇总。
2. `sheriff_vote_cast` / `sheriff_candidate_declared`：
   - 逐条仅行动者可见；
   - 汇总公开。
3. `live` 结构：
   - 狼队顺序为上帝播报；
   - 遗言为 `[live][遗言][x]`；
   - 终局为 `[live][上帝][终局]`。
4. 文案本地化：
   - 终局 `winner/reason`、女巫 `potionType`、开局角色名均中文化。
5. 标签与措辞约束：
   - 除 `[上帝私有]` 外无 `[私有]` 标签；
   - 广播文案不出现“你”。

---

## 9. 代码锚点（当前实现）

1. 玩家广播：`backend/src/mechanisms/broadcast/agent_event_line_registry.ts`
2. 玩家广播聚合：`backend/src/engine/agent_broadcast_feed.ts`
3. live 渲染：`backend/src/mechanisms/script/event_render_registry.ts`
4. 角色/机制事件文案：
   - `backend/src/mechanisms/roles/wolf/event_presenters.ts`
   - `backend/src/mechanisms/roles/seer/event_presenters.ts`
   - `backend/src/mechanisms/roles/guard/event_presenters.ts`
   - `backend/src/mechanisms/roles/witch/event_presenters.ts`
   - `backend/src/mechanisms/last_words/event_presenters.ts`
   - `backend/src/mechanisms/sheriff/event_presenters.ts`
5. 回放落盘：`backend/src/scripts/run_llm_game.ts` / `backend/src/session_recording/*`
