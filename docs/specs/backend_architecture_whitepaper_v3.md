# 🐺 V3 Agentic Game Engine 终极全景架构与落地实现细节白皮书

## 1. 当前代码详细文档

这是一份为 V3 后端重构准备的**最高指导规范（Source of Truth）**。它覆盖了系统从底层内存结构到顶层业务逻辑的完整架构细节，作为后续编码实现与评审的统一标准。

***

# 🐺 V3 Agentic Game Engine 终极全景架构白皮书

## 🎯 核心架构哲学 (Core Philosophy)
1. **状态串行、请求并行 (State-Serial, Request-Parallel)**：状态修改与结算保持严格串行，避免并发竞态；但在“互不依赖的决策采样窗口”中允许并行发起 Agent 请求（如放逐投票、狼人自爆窗口），再按确定性规则合并结果。
2. **混合范式 (OOP + ECS)**：**OOP（面向对象）**构建全局唯一、稳定流转的状态机与时间线；**ECS（实体-组件-系统）**化解复杂的业务逻辑，将“警徽”、“中毒”全部抽象为可动态挂载的数据组件。
3. **知行解耦 (Function Calling First)**：大模型的“内心戏”与“外在行为”在物理层面隔离。一切对游戏世界状态的修改，必须通过强制 Schema 校验的 JSON 工具调用（Tool Calls）。
4. **LLM-Native 动态叙事**：拒绝向模型发送干瘪的 JSON。底层数据结构自带 `render_prompt()` 方法，自动将底层状态翻译为极具沉浸感的第一人称系统指令。

---

## 🏗️ 第一层：底层数据结构与 ECS 引擎 (The ECS Foundation)

ECS 架构是 V3 引擎能够兼容无限变种板子的基石。

### 1.1 实体 (Entity)
极其纯粹，仅包含唯一标识符（如 `Player_1`）和连接到具体 LLM 实例的 Session ID。它是一个空壳，等待组件的挂载。

### 1.2 组件 (Components) & 动态叙事渲染 (Hydration)
组件是纯数据字典，但强制实现 `render_prompt()` 接口，用于在组装上下文时生成自然语言指令。
* **`RoleComponent` (底牌组件)**
  * *数据*：`{"role": "女巫", "camp": "好人", "potions": {"heal": 1, "poison": 1}}`
  * *渲染*：`"你的底牌是【女巫】，你拥有一瓶解药和一瓶毒药。首夜你可以自救..."`
* **`BadgeComponent` (警徽组件)**
  * *数据*：`{"is_sheriff": true, "weight": 1.5}`
  * *渲染*：`"👑 尊敬的警长，你拥有 1.5 票的归票权，并在进入白天发言时，可决定顺时针或逆时针发言。"`
* **`StatusMarkComponent` (状态印记组件)**
  * *子类*：`[守护印记]`, `[狼刀印记]`, `[解药印记]`, `[毒药印记]`, `[梦游印记]`
  * *示例 (毒药)*：`"⚠️ 致命警告：你察觉到自己被暗中使用了毒药，将在下个黎明死亡。请准备遗言！"`

### 1.3 系统 (Systems)
无状态的逻辑处理中心，在特定阶段被调用以修改组件数据。
* **`DamageResolutionSystem` (伤害结算系统)**：黎明前夕触发。扫描所有实体的印记。执行“同守同救失效”规则：若实体同具 `[守护]` 与 `[解药]`，则抹除两印记；随后若存在 `[狼刀]` 或 `[毒药]`，则标记 `AliveComponent = false`。
* **`WinConditionSystem` (胜负裁决系统)**：每次状态流转后检测 `CampComponent`（阵营组件）的存活比例，支持判定“屠边”、“屠城”或“第三方单独截胡”。

---

## ⏳ 第二层：严格串行时间线与流转钩子 (Phase & Hooks)

引擎采用 `PhaseManager` 推进游戏。游戏时间线是单向流动的链表。

### 2.1 黎明与中断钩子系统 (Interrupt Hooks)
面杀中的“拍刀自爆”在纯串行架构下被抽象为 **响应窗口 (Action Windows)**。房主可通过配置文件开关以下节点，引擎在到达节点时，会向拥有特权（如狼人、侦探）的实体发起一次极简的确认请求。
* **天亮钩子 (`on_daybreak`)**：上帝宣布死讯后，发言前。自爆可吞没首日的警长竞选。
* **警上钩子 (`on_pre_election`)**：警上所有人发言完毕，警下投票前。
* **放逐前钩子 (`on_pre_vote`)**：全员发言完毕，归票前。
* **单人发言间隙钩子 (`on_per_speech_gap`)**：**[高压配置]** 每一位玩家发言结束后立刻触发。若狼人调用 `self_destruct`，引擎立刻触发 **Hijack (劫持协议)**：强制清空当前发言队列，广播自爆信息，直接跃迁至黑夜阶段。

### 2.2 白天工作流 (State-Serial Daytime Pipeline)
1. **警长定序**：若存在警长，系统优先调用警长的 `choose_direction()` 工具，设定本轮遍历顺序为顺时针或逆时针。
2. **依次发言**：依据计算出的列表，逐个唤醒 Agent 调用 `speak()`。
3. **公开广播**：引擎将内容以 `[玩家X] 我是...` 的剧本格式写入全局 Message Bus。
4. **放逐投票**：全员发言完毕后，并行发起存活玩家 `vote(target_id, abstain)` 请求；`abstain=true` 表示该玩家弃票；引擎在全部结果返回后按固定顺序落库并结算。

### 2.3 深度定制的黑夜流水线 (Strict Night Pipeline)
黑夜不再使用并发队列，而是**完全照搬桌游物理唤醒顺序**。状态即改即生效。
* **Phase 1: 盗贼/千面人换牌** -> 动态覆写自身的 `RoleComponent`。
* **Phase 2: 丘比特连线** -> 被连结者注入 `[情侣印记]`，阵营组件可能发生变异。
* **Phase 3: 守卫行动** -> 盲守，为目标注入 `[守护印记]`。
* **Phase 4: 狼队战术环 (Wolf Tactical Loop)**
  * *步骤 A (发言)*：随机打乱狼人顺序，按同一顺序执行**最多三轮**战术交流。每名狼人调用 `speak_to_wolves(text, end_chat)` 发言；当 `end_chat=true` 时表示该狼人发言后结束自己后续夜聊轮次。结束事件仅对狼阵营广播。
  * *步骤 B (投票)*：维持该顺序，依次调用 `kill_vote(target_id, abstain)` 提交意图；`abstain=true` 表示该狼人本轮弃刀。
  * *步骤 C (落刀)*：系统计票，得票最多者立即被注入 `[狼刀印记]`。
* **Phase 5: 女巫行动** -> 系统组装 Prompt 时，若发现某实体有 `[狼刀印记]`，则通知女巫。女巫决策后注入 `[解药印记]` 或 `[毒药印记]`。
* **Phase 6: 预言家查验** -> 引擎读取目标实体底牌，立刻返回 JSON 给预言家上下文。
* **Phase 7: 黎明结算** -> `DamageResolutionSystem` 清算所有印记，产生死亡名单。

### 2.4 并行请求的确定性合并规则 (Deterministic Merge)
1. 并行仅用于“请求阶段”，不直接并发改写世界状态。
2. 所有并行请求完成后，由流水线单线程合并并写入事件流。
3. 若并行窗口出现多个冲突意图（如多个狼人同时请求 `self_destruct`），按稳定规则决议（座位号/ID 最小优先），保证回放一致性。

---

## 🧠 第三层：记忆、认知与防御机制 (Memory & Security)

### 3.1 内存分层架构 (Prompt 组装公式)
每个 Agent 每次请求的 Context 由以下四个区块严格拼接：
1. **静态规则与动态组件区 (System Fact)**：不可压缩。包含游戏基础规则设定，以及当前实体 ECS 组件调用 `render_prompt()` 实时生成的设定（如底牌、中毒警告、警长权重）。
2. **私密笔记本区 (Private Notebook)**：高优先级保留区。大模型通过工具记录的核心逻辑推演（如“5号发言漏洞百出，必为狼”）。
3. **滚动记忆摘要 (Rolling Summary)**：大模型基于历史对话自主生成的极简逻辑线索。
4. **高保真活跃上下文 (Active Context)**：近期 1-2 个完整回合的、未经压缩的 `[角色] + 原话` 纯文本对话。

### 3.2 动态记忆压缩策略 (Sliding Window Compression)
* **触发器**：引擎持续监控 `ActiveContext` 的 Token 数。当触碰设定的 Soft Limit（如 4000 Tokens）时，触发静默任务。
* **执行**：向模型发送特殊指令：*“请结合你的私密笔记，将以下远古对话提取为 500 字内的局势摘要，保留关键身份对跳与人际关系。”*
* **替换**：生成的摘要放入“滚动记忆摘要”区，清理对应的底层原始 Message。

### 3.3 角色伪造防护网 (Anti-Spoofing Gateway)
防止大模型通过 Prompt Injection 伪造系统状态：
* **输入清洗**：网关层强行转义模型 `speak()` 函数参数中企图伪造的 `[上帝]`、`[法官]` 等保留字前缀。
* **工具鉴权**：在调用任意技能前，校验该实体的 `AliveComponent` 和 `SkillComponent`。例如，已死亡的非猎人角色试图开枪，或守卫企图同守，系统将强制返回 `{"error": "非法操作，动作已被系统拦截，请重新行动"}`，逼迫大模型在当前回合重试。

### 3.4 广播可见性系统 (Visibility-Aware Broadcast)
V3 的事件总线保持“全量事件”能力，但在对外广播时必须携带可见性策略，统一通过可见性网关下发到不同玩家视图。

#### 3.4.1 可见性类型
1. `public`：全体可见（如白天发言、阶段切换、放逐结果、终局结果）。
2. `wolves_only`：仅狼人阵营可见（如狼队夜聊、狼刀投票细节）。
3. `private_targets`：仅目标玩家可见（如预言家查验结果、守卫守护细节、女巫私有行动反馈）。
4. `god_private`：仅法官/调试视角可见（如开局完整 seat->role/camp 信息），不下发到玩家广播通道。

#### 3.4.2 广播消息结构
每条广播消息必须使用统一信封：
- `type`：事件类型
- `timestamp`：事件时间戳
- `data`：业务数据
- `visibility`：可见性定义
  - `scope`: `public | wolves_only | private_targets`
  - `targetPlayerIds?`: 当 `scope=private_targets` 时必填

#### 3.4.3 路由规则
1. 引擎内部仍记录完整 `GameEvent`，用于回放、审计和离线调试。
2. `SessionManager` 将内部事件翻译为“可见性广播事件”后交给 `Broadcaster`。
3. `Broadcaster` 依据连接注册信息（`playerId` + `role`）执行过滤投递：
   - `public` -> 全局广播
   - `wolves_only` -> 仅投递给注册且身份为狼人的连接
   - `private_targets` -> 仅投递给目标玩家连接
4. 玩家端只提交自己的 `playerId` 与 `role`，即可自动获得自己可见事件，无需在业务层重复手写过滤逻辑。

#### 3.4.4 约束
1. 私有信息（如 `seer_checked` 结果）严禁通过 `public` 广播。
2. 任何新增事件类型必须在映射层显式声明可见性，禁止隐式默认可见。
3. 可见性过滤发生在服务端，客户端不得作为唯一防线。

### 3.5 Agent 会话消息流与 SDK Tool Loop
为降低“上下文断裂”和“手工 JSON 解析漂移”风险，V3 Agent 执行链路统一升级为“独立消息流 + OpenAI SDK Tool Calling”。

#### 3.5.1 Agent 独立消息列表
1. 每个玩家 Agent 维护独立消息列表（按 `playerId` 隔离），消息格式遵循 chat schema（`system/user/assistant`）。
2. 每条可见广播事件到达后，立即以聊天消息形式插入对应 Agent 的消息列表（例如 `user` 侧系统播报）。
3. 消息列表保留滚动窗口，超出阈值后按策略裁剪，避免无限增长。

#### 3.5.2 广播注入规则
1. 默认规则：可见广播事件直接注入 Agent 历史。
2. 特殊规则：放逐阶段的投票过程不逐票公开给所有人，仅在结果阶段统一广播放逐结果。
3. 狼人例外：狼刀投票与狼队夜聊继续按串行过程对狼阵营广播（用于战术一致性）。

#### 3.5.3 工具调用执行模型
1. 行动执行统一迁移到 OpenAI SDK 原生 tool calling（`tools/tool_choice/tool_calls`）。
2. 每个行动回合由模型自主组织：
   - 模型可发起一个或多个 tool call；
   - 引擎回填 tool result；
   - 直到模型主动结束本回合（无工具调用或显式结束工具）为止。
3. 禁止把“模型回复文本 JSON 解析”作为主路径；文本恢复仅允许作为降级兜底，不得覆盖工具鉴权。

### 3.6 当前完整渲染管线（代码实装）
本节描述当前后端“事件 -> 可见信息 -> Agent 提示词 -> 工具调用 -> 行动落地”的完整链路。

#### 3.6.1 事件生成层（Engine）
1. `PhaseManager` 串行推进 `night -> day -> voting`，各阶段流水线持续写入 `GameEvent`。
2. 在 `day`/`voting` 的自爆窗口与 `voting` 投票请求阶段，采用“并行请求 + 串行落地”的混合调度。
2. 关键事件包括：`day_speech`、`wolf_discussion`、`wolf_kill_vote_cast`、`seer_checked`、`voted_out`、`game_over` 等。

#### 3.6.2 玩家可见信息渲染层（Agent Broadcast Feed）
1. 每次请求动作前，流水线调用 `buildAgentBroadcastFeed(world, events, actorId)` 生成该玩家可见事件文本。
2. 可见性规则：
   - 公开事件：全员可见（如发言、天亮、放逐结果、终局）。
   - 狼队事件：仅狼人可见（夜聊、狼刀票）。
   - 私有事件：仅行动者本人可见（查验、守护、用药）。
3. 投票阶段规则：`vote_cast` 的公开广播采用“统一时点发布”策略（放逐结算时统一对外广播），避免后位玩家在投票前读取前位投票信息；狼刀票仍对狼阵营串行可见。

#### 3.6.3 Agent 消息历史注入层（Per-Player Chat History）
1. `LlmActionProvider` 维护 `Map<playerId, ChatMessage[]>` 独立历史。
2. 每轮请求前直接消费 3.6.2 产出的“玩家可见信息渲染层”结果（`broadcast_feed`），按增量注入广播行（写入 `user` 消息，前缀 `【广播】`）。
3. 再拼接当前回合 `user` 指令块，得到本轮 `messages`：
   - `system`：工具调用规则、turn constraints 约束、禁止输出要求。
   - `history`：该玩家历史消息（含广播与先前 assistant 回复）。
   - `current_user`：本轮阶段上下文与参数提示。

##### 3.6.3.1 `prompt_user` 结构规范（固定顺序）
`prompt_user` 由两部分组成，顺序固定：
1. 广播行（0..N 条）：每条单独一条 `user` message，格式为 `【广播】{line}`。
2. 当前回合指令块（1 条）：单条 `user` message，多行键值文本，字段顺序如下：
   - `玩家编号={number}`
   - `行动窗口={standard_round|...}`
   - `turn_constraints={json_object}`
   - `你的身份={wolf|seer|...}`
   - `可用工具={json_array}`
   - `阶段上下文={json_object}`
   - `存活玩家视图={string}`
   - `你就是当前玩家，不要把其他玩家的身份当成你自己的身份。`
   - `工具参数提示={tool_name args: ...}`
   - `请调用函数工具执行本回合动作。`

约束：
1. 字段名与顺序保持稳定，便于测试与日志比对。
2. `阶段上下文` 必须包含 `broadcast_feed`（来自 3.6.2 可见信息层）。
3. `当前阶段` 由上帝公开广播（`phase_changed` -> `【广播】[系统][公开] ...`）承载，不再作为指令块字段重复注入。

##### 3.6.3.2 真实 messages 列表示例（代码实装）
以下示例对应“1号狼人夜间狼刀回合”的实际消息形态（简化字段）：

```json
[
  {
    "role": "system",
    "content": "你是狼人杀引擎中的单个玩家智能体...仅可调用本轮可用工具：kill_vote...请调用 finish_turn 结束回合。"
  },
  {
    "role": "user",
    "content": "【广播】[狼队][顺序] 2->1"
  },
  {
    "role": "user",
    "content": "【广播】[夜聊][狼队][2] 队友1，今晚我们先看3号..."
  },
  {
    "role": "assistant",
    "content": "<think>我同意先刀3号...</think>"
  },
  {
    "role": "user",
    "content": "玩家编号=1\n行动窗口=standard_round\nmustAct=true\n可用工具=[\"kill_vote\"]\n阶段上下文={...}\n存活玩家视图=1:wolf,2:wolf,3:unknown..."
  },
  {
    "role": "assistant",
    "content": "",
    "tool_calls": [
      {
        "id": "call_xxx",
        "type": "function",
        "function": {
          "name": "kill_vote",
          "arguments": "{\"target_id\":3}"
        }
      }
    ]
  },
  {
    "role": "tool",
    "tool_call_id": "call_xxx",
    "content": "{\"ok\":true,\"accepted\":true}"
  }
]
```

说明：
1. `system` 仅在请求组装时注入，不写入长期历史存储。
2. `history` 部分按 `playerId` 隔离，玩家之间不共享。
3. `tool` 消息由服务端回填，是 SDK tool loop 的标准回合结构。

#### 3.6.4 工具调用执行层（OpenAI SDK Tool Loop）
1. 主路径走 OpenAI SDK `chat.completions` 的 `tools/tool_calls` 回合循环：
   - 下发 `allowedTools + finish_turn` schema；
   - 接收模型 `tool_calls`；
   - 服务端回填每个 tool 的执行结果；
   - 模型继续下一步，直到产出可接受行动或主动结束回合。
2. 工具参数仍经过服务端约束校验（name/args 白名单、枚举值与数字字段纠正）。
3. 下发给 SDK 的每个工具定义必须包含完整语义说明：`tool.description` 与各参数字段 `properties.<param>.description` 均为必填；并通过 `required`/`additionalProperties=false` 显式约束输入边界，避免模型在参数语义不明确时产生无效调用。
4. 若 SDK 工具调用不可用或请求异常，才走文本解析/恢复 + fallback 兜底路径。
5. 可观测性：`run_llm_game --print-thinking true` 时，运行日志输出 SDK 回合“思考轨迹”（`assistant` 文本 + `tool_call/tool_result`），用于排查模型决策链路；该输出与 `--print-llm-io` 解耦，可单独开启。
6. 旁观私有事件日志：`--print-private-events` 控制控制台是否输出私有事件明细（如 `seer_checked`）；默认开启，仅影响旁观日志，不改变 Agent 视角隔离。

#### 3.6.5 回合约束与多工具会话（目标架构补充）
为支持“单回合多次工具交互 + Agent 主动结束回合”的体验，V3 执行链路新增以下目标约束模型：

1. **多工具回合**
   - 单个回合内允许多次工具调用；
   - 每次工具调用后服务端立即回填结果（如狼刀投票受理、预言家查验结果、女巫用药受理）；
   - 是否结束回合由 Agent 显式调用 `finish_turn` 决定。

2. **Turn Constraints（回合约束）**
   - 以结构化约束替代单一 `mustAct` 布尔值；
   - 约束字段包括：
     - `required_actions`：本轮必须完成的动作集合；
     - `selection_rules`：目标选择规则（如必须从候选列表中选且不可空）；
     - `cardinality`：动作次数上下界（如 `min=1,max=1`）；
     - `end_condition`：允许 `finish_turn` 的前置条件；
     - `retry_policy`：不满足约束时的重试提示策略。

3. **结束前校验**
   - Agent 请求结束回合时，先执行约束校验；
   - 若仍缺少必需动作，系统向同一消息流追加“必须行动”提示并继续当前回合，不切换阶段。

4. **行动校验解耦**
   - 将“工具参数/阶段窗口/约束满足性”从 loop 主流程中抽离到独立校验服务；
   - loop 层仅负责消息往返与工具调度；
   - 校验服务输出统一判定结果，供事件落库、重试提示和 fallback 共用。

#### 3.6.5 行动落地层（Validation & State Mutation）
1. `LlmActionProvider` 返回 `ToolCall` 给 phase pipeline。
2. pipeline 调用 `ToolGateway.validateAndSanitize(...)` 做最终鉴权和参数合法化。
3. 校验通过后才写入状态/事件（例如挂印记、计票、发言落盘、死亡结算）。

#### 3.6.6 PromptAssembler 在当前链路中的定位
1. `PromptAssembler` 仍保留为记忆层拼装模块（系统事实/私密笔记/滚动摘要/近期上下文）。
2. 当前主行动链路由 `LlmActionProvider` 直接构建消息，不依赖 `PromptAssembler` 作为主入口。
3. 出于隐私安全，`PromptAssembler` 当前不渲染 `StatusMarksComponent`，避免将狼刀/守护/解药/毒药等潜在隐私印记直接暴露给 Agent。

---

## 📚 第四层：全量机制与角色支持矩阵 (Supported Lexicon)

基于这套 ECS 与串行注册架构，系统原生无缝兼容以下所有逻辑：

### 4.1 核心机制支持
* **上警系统**：竞选、退水、移交警徽、撕毁警徽、警长 1.5 票权、警长决定顺/逆时针发言。
* **遗言系统**：`EventRegistry` 自动拦截判定，仅支持【首夜死亡】与【白天放逐死亡】触发临时遗言 Phase。
* **多重结算嵌套**：完美处理例如“河豚被投翻牌带走狼人 -> 狼人出局触发技能”等基于 Event 总线的栈式递归结算。

### 4.2 全系角色库支持 (涵盖但不限于)
* **神职 (Standard & Awakened)**：
  * *常规*：预言家、女巫、猎人、守卫、摄梦人、魔术师、骑士、纯白之女、定序王子、猎魔人、守墓人、奇迹商人、乌鸦、白昼学者、流光伯爵、炼金魔女、白猫、河豚、子狐、熊、通灵师、侦探、警犬、舞者、魔镜少女。
  * *觉醒*：觉醒愚者（秘密之身抵挡伤害）、觉醒预言家（双验出金水/查杀）、觉醒女巫（三协助者发毒）、觉醒守卫、觉醒猎人。
* **狼队 (Standard & Awakened)**：
  * *常规*：普通狼人、狼王、噩梦之影（范围禁言）、狼巫、血月使徒（封印神技）、狼美人、蚀时狼妃（反伤盾）、恶灵骑士、寂夜导师、蚀日侍女、狼鸦之爪、石像鬼、隐狼、白狼王、夜之贵族、寻香魅影、怪盗狼王、假面。
  * *特殊实现【机械狼/觉醒隐狼】*：夜间触发“学习”后，系统热替换该实体的 `SkillComponent`。学会守卫即获护盾，学会狼人即获二刀。
  * *觉醒*：觉醒狼王（亲传狼王爪）、觉醒狼美人、觉醒石像鬼（强制转化相邻神民）、觉醒白狼王。
* **第三方与环境异变 (Third-Party & Mutators)**：
  * 丘比特、咒狐、孤独少女/觉醒孤独少女。
  * *【黑死病模式】*：剥离狼人阵营，系统级注入 `EnvironmentSystem` 接管夜间随机抹杀逻辑。
  * *【灯影预言家】*：系统底层拦截预言家查询结果并强制取反（Reverse Boolean），大模型在浑然不觉中进行反向推理。

## 2. 开发任务清单

1. 将本白皮书逐项映射到 V3 后端的可执行模块与配置：
   - `PhaseManager`
   - `EventRegistry`
   - `ComponentRegistry`
   - `ToolGateway`
   - `PromptAssembler`

2. 为每个“系统/钩子/角色能力”补齐：
   - 输入 schema
   - 输出 schema
   - 冲突优先级
   - 回放日志字段

3. 基于本白皮书建立 V3 开发追踪矩阵：
   - 机制实现状态（未开始/开发中/已完成）
   - 自动化测试覆盖状态
   - 性能与 Token 消耗基线

4. 将当前 `backend/src/*` 源码注释逐步升级为“实现对白皮书条款”的逐文件映射说明。

## 3. 验收标准（任务映射）

1. 信息完整性：
   - [ ] 本文覆盖输入架构参考中的全部机制与角色信息，无缺漏。

2. 架构一致性：
   - [ ] V3 后端实现与本文定义的串行时序、ECS 组件模型、工具鉴权模型一致。

3. 可执行性：
   - [ ] 研发可仅凭本文完成模块拆分、接口定义与阶段实现。

4. 可验证性：
   - [ ] 每条关键规则（中断钩子、狼队战术环、同守同救、反向查验等）均可被自动化测试回归验证。
