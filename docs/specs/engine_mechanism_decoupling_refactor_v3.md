# v3 engine-mechanism decoupling refactor

## 1. 目标与范围

目标：将“游戏引擎框架（调度/状态/事件）”与“玩法机制（角色能力/阶段细则/规则约束）”彻底解耦，使新增角色、改板子、改技能规则尽量通过注册与配置完成，而不是修改框架主流程代码。

本次文档覆盖：

1. 当前实现中违反解耦目标的耦合点清单。
2. 目标架构（注册中心 + 机制插件化）。
3. 分阶段改造计划与 TODO。
4. 可执行验收标准（开发与回归测试口径）。

非目标：

1. 本文不直接重写所有旧逻辑，只定义重构边界与实施顺序。
2. 本文不改变现有业务规则语义（例如“守卫不可连守”“白痴翻牌免死”等规则本身保持不变）。

---

## 2. 当前违反解耦目标的主要耦合点

### 2.1 框架流水线直接写死角色机制

问题：`night/day/voting` 流水线中直接硬编码角色行为与顺序，导致新增角色或新夜间阶段必须改引擎代码。

典型位置：

1. `backend/src/engine/phase_pipeline/night_pipeline.ts`
2. `backend/src/engine/phase_pipeline/day_pipeline.ts`
3. `backend/src/engine/phase_pipeline/voting_pipeline.ts`

表现：

1. 夜间执行顺序写死为“狼人夜聊 -> 守卫 -> 狼刀 -> 女巫 -> 预言家 -> 伤害结算”。
2. 白天/投票阶段直接内嵌“狼人自爆窗口”逻辑。
3. 放逐与夜间操作工具名在流水线内写死（`guard`/`kill_vote`/`vote`...）。

### 2.2 校验器与网关混入角色规则细节

问题：动作网关层既做输入校验又做角色规则判定，规则变化会牵动网关基础设施。

典型位置：

1. `backend/src/gateway/action_validator.ts`
2. `backend/src/gateway/tool_gateway.ts`

表现：

1. `switch(toolCall.name)` 中写死各角色规则（女巫双药、守卫连守、猎人开枪条件等）。
2. `startNight` 在网关里直接重置女巫状态。

### 2.3 LLM 提示层硬编码角色与技能文案

问题：Prompt 构造层直接维护角色标签、技能简介、阶段提示和参数提示，不可复用且难扩展。

典型位置：

1. `backend/src/v3/llm_action_provider.ts`

表现：

1. `roleLabel` / `roleSkillBrief` 针对 `Role` 枚举硬编码。
2. `stageDirective` 对 `kill_vote/use_potion/...` 写死规则文本。
3. `toolArgHints` 对全部工具手写参数提示。

### 2.4 事件注册器承担具体角色机制

问题：`EventRegistry` 不是“注册中心”，而是承载具体角色逻辑（白痴、猎人）的执行器。

典型位置：

1. `backend/src/engine/event_registry.ts`

表现：

1. `onVotedOut` 内写死白痴翻牌免死与票权变化。
2. `onDeath` 内写死猎人闷枪/开枪逻辑。

### 2.5 角色注册表能力不足（仅工具白名单）

问题：现有角色注册表仅管理角色可用工具，无法描述角色完整机制与生命周期钩子。

典型位置：

1. `backend/src/domain/registries/role_registry.ts`

表现：

1. 仅有 `role -> allowedTools`。
2. 不包含角色 prompt、阶段参与条件、执行器、事件处理器、状态初始化等。

---

## 3. 目标架构（解耦后）

## 3.1 设计原则

1. 框架只负责“何时执行（时序）”和“如何执行（调度/事件/状态）”。
2. 机制只负责“执行什么（角色行为/规则）”。
3. 框架通过注册中心读取机制定义，不直接感知具体角色名与技能细节。

## 3.2 模块分层

1. Framework Core（稳定层）
   - `PhaseOrchestrator`：阶段调度与循环推进。
   - `ActionDispatcher`：按 Stage 调度动作请求。
   - `StateStore(World)`：实体与组件状态。
   - `EventBus`：事件追加与订阅。
   - `WinEvaluator`：胜负判定入口（策略可注入）。

2. Mechanism Pack（可插拔层）
   - `RoleSpec`：角色元信息（名称、阵营、私有状态初始化、prompt 贡献）。
   - `ToolSpec`：工具 schema、参数说明、默认修复策略。
   - `StageSpec`：阶段/子阶段定义与执行器（如 `wolf_discussion`、`witch_action`）。
   - `RuleSpec`：规则校验器与冲突裁决器。
   - `HookSpec`：事件钩子（`on_death`、`on_voted_out` 等）。

3. Board Config（装配层）
   - 声明启用哪些 `RoleSpec/StageSpec/RuleSpec`，不关心其内部实现。

## 3.3 必要注册中心

1. `RoleSpecRegistry`
   - `registerRole(spec)` / `getRole(roleId)`。
   - 提供：角色 prompt、技能简介、状态初始化器、可用工具集合（按阶段可变）。

2. `ToolSpecRegistry`
   - `registerTool(spec)` / `getTool(name)`。
   - 提供：OpenAI tool schema、参数提示文案、sanitize/repair、校验入口。

3. `StageRegistry`
   - `registerStage(spec)` / `getStageOrder(phase, board)`。
   - 每个 stage 具备 `isEnabled(ctx)` 与 `execute(ctx)`。

4. `HookRegistry`
   - `registerHook(eventType, handler)`。
   - 替代当前 `EventRegistry` 内硬编码角色机制。

5. `PromptContributorRegistry`
   - 由角色/板子/阶段分别注册 prompt 片段，LLM 层按上下文聚合。

## 3.4 对现有模块的落位要求

1. `NightPipeline/DayPipeline/VotingPipeline`
   - 改为通用 stage runner，不再写具体角色行为。
2. `ActionValidator`
   - 只做通用校验（存活、阶段、参数合法性），角色特定规则下沉到 `RuleSpec`。
3. `ToolGateway`
   - schema 与 sanitize 来源改为 `ToolSpecRegistry`。
4. `LlmActionProvider`
   - 角色技能简介、阶段强指令、参数提示改为 registry 产出，不保留角色枚举硬编码。

---

## 4. 分阶段改造计划（建议顺序）

## P0：冻结行为基线

1. 先补齐现有规则回归测试（夜间、白天、投票、死亡钩子、fallback）。
2. 固化一批回放 session 作为行为对照样本。

## P1：工具与提示解耦（低风险，先做）

1. 新增 `ToolSpecRegistry`，把 `gateway/schemas/*` 统一注册化。
2. `LlmActionProvider.toolArgHints/stageDirective` 改读 registry。
3. `ActionValidator` 抽出通用与角色特定规则两个层次。

## P2：阶段机制解耦（核心）

1. 新增 `StageRegistry` 与 stage 执行接口。
2. 将 `night_pipeline` 内“狼人聊/守卫/狼刀/女巫/预言家”拆成独立 stage handler 文件。
3. `PhaseManager` 只按注册顺序执行 stage，不再写死角色步骤。

## P3：事件钩子机制解耦

1. 抽离 `EventRegistry` 中白痴/猎人逻辑为 HookSpec。
2. `on_death/on_voted_out` 改为事件总线分发 + hook 聚合结果。

## P4：角色机制模块化

1. 每个角色独立目录：
   - `roles/wolf/*`
   - `roles/witch/*`
   - `roles/seer/*`
   - ...
2. 统一导出 `registerXxxRolePack(registryBundle)`。
3. 板子配置只描述“启用哪些 role pack + stage pack + hook pack”。

---

## 5. TODO 清单（可执行）

- [x] `D01` 新增 `backend/src/mechanisms/contracts.ts`：定义 `RoleSpec/ToolSpec/StageSpec/HookSpec`。
- [x] `D02` 新增 `backend/src/mechanisms/registries/*`：实现 4 大注册中心。
- [x] `D03` 将 `gateway/schemas/*` 接入 `ToolSpecRegistry`，移除 `ToolGateway` 构造器硬编码注册。
- [x] `D04` 将 `llm_action_provider.ts` 中角色文案、阶段指令、参数提示迁移到 `PromptContributorRegistry` + `ToolSpecRegistry`。
- [x] `D05` 拆分 `night_pipeline.ts` 为可注册 stage handlers（不含角色硬编码分支）。
- [x] `D06` 拆分 `EventRegistry` 中白痴/猎人逻辑为 hook handlers。
- [x] `D07` 将 `RoleRegistry` 升级为 `RoleSpecRegistry`（保留兼容层，避免一次性大改）。
- [x] `D08` 为新注册架构补齐单测与集成回归测试。
- [x] `D09` 新增 `WinConditionRegistry`，将 `slaughter_city/slaughter_side` 胜利规则注册化，移除框架对 `WinConditionSystem` 的硬编码依赖。
- [x] `D10` 重组 `backend/src/v3`：行为提供器迁移到 `backend/src/agents/*`，`src/v3/*` 仅保留兼容导出。
- [x] `D11` 继续清理框架中残留角色语义分支（`view_mapper`、`agent_broadcast_feed`、`infra/transport/broadcaster`）。
- [x] `D12` 将角色私有状态从 `domain/components/role.ts` 特化字段迁移为机制层 `privateState` 访问器。
- [x] `D13` 将 `v3_session_manager` 的事件翻译分支迁移到 `RealtimeEventRegistry`。
- [x] `D14` 将 `agent_broadcast_feed` 的事件文案分支迁移到 `AgentEventLineRegistry`。

---

## 7. 2026-04-10 全量扫描结论

### 7.1 已确认完成的解耦点

1. 夜间角色阶段执行已通过 `NightStageRegistry` + `mechanisms/roles/*/night_stages.ts` 注册化。
2. 工具 schema/参数提示/阶段强指令已由 `ToolSpecRegistry` 提供。
3. 胜利条件已迁移到 `mechanisms/registries/win_condition_registry.ts`，支持按 `WinCondition` 注册和扩展。
4. `src/v3` 中核心实现已迁移到 `src/agents`，`v3` 目录转为兼容层。

### 7.2 当前剩余高优先级耦合点

1. 暂无阻塞性高优先级耦合点；当前角色/机制语义已迁移到 mechanisms 注册层。
2. 后续可选优化：把更多前端事件 payload 字段约束提取为 schema registry，进一步收敛 `server` 层类型定义。

---

## 6. 验收标准（完成定义）

### 6.1 代码结构验收

1. `phase_pipeline/*` 中不再出现具体角色名分支（`Role.Wolf/Role.Witch/...`）。
2. `llm_action_provider.ts` 不再维护角色技能硬编码映射函数。
3. `ToolGateway` 不再在构造时硬编码注册工具 schema。
4. 新增角色时，框架核心文件不需要改动（允许仅新增机制包与配置）。

### 6.2 行为一致性验收

1. 现有 `six_player_mvp` 与 `twelve_player_standard` 回归测试全部通过。
2. 重构前后同一脚本输入下，关键事件序列一致（允许时间戳差异）。
3. 现有会话复盘输出结构保持兼容（字段可增不可破坏）。

### 6.3 扩展性验收

1. 新增一个“示例角色包”（可用 dummy 技能），不修改 `PhaseManager/night/day/voting pipeline` 核心文件即可接入。
2. 新增一个“示例夜间 stage”，仅通过 `StageRegistry` 注册即可进入执行顺序。

### 6.4 文档验收

1. 本文档对应的实现 TODO 在开发活动文档中可跟踪（任务编号、状态、验收映射）。
2. 所有新增 registry 与机制接口有最小示例与注释。
