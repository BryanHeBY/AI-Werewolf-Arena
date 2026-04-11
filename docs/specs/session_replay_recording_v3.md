# session replay recording v3

## 1. 需求确认

目标：为每一局对局生成可持久化的 `session` 复盘记录，供后端调试与前端复盘页面直接消费。

硬性要求：

1. 记录目录固定在 `record/`（项目根目录）下。
2. 每局按 `session_id` 创建独立子目录：`record/<session_id>/`。
3. 不同类型信息分文件存储，全部使用 JSON 格式。
4. 记录内容至少覆盖：
   - 对局基本信息（接近 `--print-all-events true --print-chat true` 可见信息）。
   - 游戏逻辑操作（规则层结算、阶段推进、校验结果等）。
   - 玩家视角记录（每个玩家独立，包含思考文本与工具调用信息）。

---

## 2. 存储结构（V1）

每局目录结构：

```text
record/
  <session_id>/
    manifest.json
    public_timeline.json
    logic_ops.json
    players/
      player_1.json
      player_2.json
      ...
```

### 2.1 `manifest.json`

用途：索引本局基础元信息与文件清单。

建议字段：

- `session_id: string`
- `board: string`
- `started_at: string`（ISO 时间）
- `ended_at: string`（ISO 时间）
- `winner: "good" | "wolf" | "third_party" | null`
- `finish_reason: string`
- `players: Array<{ player_id:number; role:string; camp:string; alive:boolean }>`
- `files: { public_timeline:string; logic_ops:string; player_views:string[] }`
- `schema_version: "v1"`

### 2.2 `public_timeline.json`

用途：记录全局公开视角时间线（近似控制台公开播报与 chat 输出）。

建议结构：

- `events: Array<{`
  - `seq: number`
  - `timestamp: string`
  - `phase: string`
  - `day: number`
  - `type: string`
  - `payload: Record<string, unknown>`
  - `render_text?: string`
`}>`

### 2.3 `logic_ops.json`

用途：记录规则执行与关键内部操作（便于调试结算与回放“为什么会这样”）。

建议结构：

- `ops: Array<{`
  - `seq: number`
  - `timestamp: string`
  - `scope: "phase_pipeline" | "gateway" | "registry" | "resolution" | "llm_action_provider"`
  - `op: string`（如 `validate_tool_call`、`apply_guard_mark`、`resolve_vote_tally`）
  - `actor_id?: number`
  - `phase?: string`
  - `input?: Record<string, unknown>`
  - `output?: Record<string, unknown>`
  - `status: "ok" | "rejected" | "fallback" | "error"`
  - `reason?: string`
`}>`

### 2.4 `players/player_<id>.json`

用途：单玩家视角复盘，包含其可见信息、思考、工具行动。

排布规则（强约束）：

1. 使用单一 `timeline`，按真实时间顺序混排广播与行动。
2. 每次请求按“先广播，后行动”的顺序写入：
   - `broadcast` 条目：记录该次请求前新增可见广播；
   - `action` 条目：记录该次请求的思考、工具调用与最终行动。
3. `tool_calls` 字段固定存在，不做可选；未调用工具时存 `[]`。
4. 为兼容未来非工具行动，保留 `action_mode` 字段区分模式。

建议结构：

- `player_id: number`
- `role: string`
- `camp: string`
- `timeline: Array<{`
  - `seq: number`
  - `kind: "broadcast" | "action"`
  - `day: number`
  - `phase: string`
  - `request_id: string`（建议：`${day}-${phase}-${seq}`）
  - `text?: string`（`kind="broadcast"` 时的广播文本）
  - `feed_cursor_before?: number`
  - `feed_cursor_after?: number`
  - `prompt_system?: string`（建议仅在内容变化时落盘）
  - `prompt_system_ref?: string`（未变化时引用上一份 system prompt）
  - `prompt_user_delta?: string[]`（仅本次请求新增 user 内容）
  - `thinking_text?: string`（来自 SDK thinking trace / assistant 原文）
  - `action_mode: "tool_call" | "text_action" | "none"`
  - `tool_calls: Array<{ name:string; args:Record<string,unknown>; accepted?:boolean; result?:Record<string,unknown>|string }>`
  - `text_action?: { text:string; parsed_action?: { name:string; args:Record<string,unknown> } }`
  - `final_action?: { name:string; args:Record<string,unknown> }`
  - `fallback?: { used:boolean; reason?:string; action?:{ name:string; args:Record<string,unknown> } }`
  - `truncated?: { thinking_text?: boolean; prompt_user_delta?: boolean }`
`}>`

冗余控制建议：

1. 广播以 `timeline.kind="broadcast"` 逐条增量写入，避免每轮复制全量 feed。
2. `prompt_system` 变化频率低，建议按引用去重（`prompt_system_ref`）。
3. 超长 `thinking_text` 允许截断，并显式标记 `truncated.thinking_text=true`。

---

## 3. 架构变动（文档设计）

新增模块建议：

1. `backend/src/session_recording/session_record_manager.ts`
   - 负责 session 生命周期（`startSession/endSession`）与 JSON 文件落盘。
   - 管理序号、缓存、最终 flush。
2. `backend/src/session_recording/types.ts`
   - 统一 `manifest/public_timeline/logic_ops/player_view` 类型定义。
3. `backend/src/session_recording/json_writer.ts`
   - 原子写入（先写临时文件再 rename），避免半写文件。

现有链路接入点：

1. `run_llm_game.ts`
   - 初始化 session 目录。
   - 在每次事件广播时写入 `public_timeline`。
   - 对局结束后写 `manifest` 并关闭记录器。
2. `llm_action_provider.ts`
   - 记录每个玩家回合的 prompt、thinking、tool_call/tool_result、fallback 信息到 `players/player_<id>.json`。
3. `phase_pipeline/*` 与 `gateway/action_validator.ts`
   - 写入 `logic_ops`（如动作校验通过/拒绝、结算目标、计票结果、阶段切换）。

---

## 4. 非目标与约束

非目标（本迭代不做）：

1. 不做数据库落地，仅文件系统存储。
2. 不做前端 UI 实现，仅提供可消费 JSON 协议。
3. 不做历史索引服务（如全局 session 列表 API），后续单独需求再补。
4. 不实现“对局结束后复盘聊天”实时功能（仅记录设计意图）。

约束：

1. 不得记录 API key、base url 中密钥信息。
2. 文件写入失败不应中断主对局流程：记录器需降级为告警日志。
3. 需要保证一次对局的 `seq` 全局单调递增（同一文件内）。

---

## 5. TODO（实现分解）

- [ ] `SR01` 新增 `session_recording` 模块与 JSON 类型定义，支持按 `session_id` 创建目录与文件。
- [ ] `SR02` 接入 `run_llm_game.ts`：落地 `manifest/public_timeline`。
- [ ] `SR03` 接入 `llm_action_provider.ts`：落地 `players/player_<id>.json`（含 thinking 与工具调用）。
- [ ] `SR04` 接入 `phase_pipeline + action_validator`：落地 `logic_ops.json`。
- [ ] `SR05` 增加容错：写盘异常仅告警，不中断对局。
- [ ] `SR06` 补充测试：目录创建、文件结构、关键字段完整性、异常降级。

---

## 6. 验收标准

- [ ] `SA01` 执行一局 `run:v3:six` 后，生成 `record/<session_id>/` 目录，且包含 `manifest.json/public_timeline.json/logic_ops.json/players/`。
- [ ] `SA02` `public_timeline.json` 可覆盖公开时间线（至少包含：天黑、天亮、发言、投票、结果）。
- [ ] `SA03` 每个 `players/player_<id>.json` 使用单一 `timeline`，且满足“broadcast 在前、action 在后”的时间顺序；`tool_calls` 字段固定存在（可为空数组）；并在 `action` 条目中包含 `action_mode`（若该玩家确实行动过，至少有 1 条含 `thinking_text` 或有效行动信息）。
- [ ] `SA04` `logic_ops.json` 包含动作校验与至少一种结算操作（如狼刀结算/放逐计票）。
- [ ] `SA05` 模拟写盘失败时，对局仍可结束，日志出现 recording warning，主流程不崩溃。

---

## 7. 规划：终局复盘聊天（仅文档，不落地）

目标：对局结束后允许全部玩家进入复盘聊天，便于复盘和训练。

设计约束：

1. 仅在 `game_over` 后开启，不影响对局公平性。
2. 可配置是否公开全部信息（例如狼队夜聊、查验结果、守卫守护）。
3. 复盘聊天应写入 `public_timeline` 与 `players` 视角，方便复盘检索。

建议配置（不影响现有对局逻辑）：

- `postGameChat.enabled: boolean` 默认 false。
- `postGameChat.revealAll: boolean` 默认 false。
- `postGameChat.rounds: number` 默认 1。

建议事件（仅规划，不实现）：

- `post_game_chat_started`：触发复盘聊天窗口。
- `post_game_speech`：玩家复盘发言。
