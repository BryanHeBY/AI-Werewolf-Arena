# 🐺 V3 版本实现要求文档：基准测试版型 (MVP)

开发驱动：`docs/drivers/backend/evolution/architecture/v3_mvp_requirements_driver.md`

## 1. 当前代码详细文档

本文件是 V3 第一批可落地开发任务清单，目标是将“6 人基础闭环”和“12 人复杂机制”转换为可执行的 ECS、Tool Calls、Hooks 任务定义。

这是一份为 V3 实现量身定制的 **《V3 Agentic Game Engine 基准测试实现要求文档 (MVP)》**。将 6 人局（基础闭环）和 12 人局（复杂机制）作为首批基准测试，是 V3 引擎的核心迭代路径。

---

# 🐺 V3 Agentic Game Engine 基准测试实现要求文档 (MVP)

## 📌 第一阶段：6人暗牌屠城局 (基础架构跑通测试)

**目标**：验证纯串行状态机、基础 ECS 组件渲染、知行解耦以及基础的夜晚/白天流转。

### 1.1 基础配置 (Board Setup)
* **板子规模**：6 人。
* **身份配置**：狼人×2，平民×2，预言家×1，守卫×1。
* **特殊规则注册**：
  * **暗牌机制 (`config.reveal_on_death = false`)**：所有出局玩家只播报死亡，不翻出底牌（组件的 `render_prompt` 不向公共总线暴露）。
  * **无警长机制 (`config.enable_sheriff = false`)**：跳过所有上警阶段与发言顺序选择逻辑，默认按系统顺序发言。
  * **胜负条件 (`conditions.slaughter_city`)**：
    * 好人阵营人数 = 0，狼人胜利。
    * 狼人阵营人数 = 0，好人胜利。

### 1.2 核心业务逻辑与 ECS 映射要求
* **守卫 (Guard)**：
  * **Tool**: `guard(target_id, abstain)`（`abstain=true` 代表空守）
  * **ECS**: 目标挂载 `[GuardMark]`。
  * **网关校验**: 记录上一晚守护目标，若 `target_id == last_night_target`，强行驳回 Tool Call。
* **狼人 (Werewolf)**：
  * **Tool**: `speak_to_wolves(text, end_chat)` (队内交流), `kill_vote(target_id, abstain)`。
  * **ECS**: 目标挂载 `[WolfKillMark]`。
* **预言家 (Seer)**：
  * **Tool**: `check_identity(target_id)`。
  * **Engine**: 直接读取目标的 `CampComponent`，在预言家的私有上下文中返回 `{"is_werewolf": true/false}`。
* **黎明结算系统 (DamageResolutionSystem)**：
  * 若某实体同时拥有 `[GuardMark]` 和 `[WolfKillMark]`，双印记抵消失效，该实体存活。
  * 否则若拥有 `[WolfKillMark]`，标记该实体死亡。

---

## 📌 第二阶段：12人标准局 (高级机制与中断测试)

**目标**：验证生命周期中断钩子（狼人自爆）、复杂结算链条（猎人开枪）以及动态组件剥离（白痴被推）。

### 2.1 基础配置 (Board Setup)
* **板子规模**：12 人。
* **身份配置**：狼人×4，平民×4，预言家×1，女巫×1，猎人×1，白痴×1。
* **特殊规则注册**：
  * **上警机制 (`config.enable_sheriff = true`)**：需实现警徽移交、1.5 票权、决定发言顺序。
  * **胜负条件 (`conditions.slaughter_side`)**：
    * 屠边局：平民人数 = 0，或神职人数 = 0，狼人胜利。

### 2.2 核心业务逻辑与 ECS 映射要求
* **女巫 (Witch)**：
  * **Tool**: `use_potion(target_id, potion_type: "heal"|"poison"|"none")`。
  * **视野系统**: 引擎在组装女巫 Prompt 前，检查自身 `potions.heal > 0`，若为真，则告知当晚 `[WolfKillMark]` 的拥有者。一旦解药用光，隐蔽视野。
  * **网关校验**: 永远拦截 `potion_type="heal" & target_id="自身"` 的请求（本板子不允许自救）。不能同夜使用双药。
  * **ECS**: 挂载 `[HealMark]` 或 `[PoisonMark]`。
* **猎人 (Hunter) [重点：死亡钩子]**：
  * **事件总线 (`EventRegistry`)**: 监听 `on_death` 事件。
  * **触发判定**:
    1. 检查是否为最后一名死亡的神职。若为真，跳过开枪阶段，直接触发游戏结束。
    2. 检查死亡来源是否包含 `[PoisonMark]`。若为真，闷枪，不触发技能。
    3. 若满足开枪条件，向猎人插入一个临时的 `ShootPhase`，强制其调用 `shoot(target_id)` 工具。
* **白痴 (Idiot) [重点：状态覆写]**：
  * **事件总线 (`EventRegistry`)**: 监听白天 `on_voted_out`（被放逐）事件。
  * **拦截逻辑**:
    1. 拦截放逐死亡结算，强制保留该实体的 `AliveComponent = true`。
    2. 向公共频道广播翻牌（公开其白痴身份）。
    3. 剥离其 `VotingComponent`（禁止后续投票）。
    4. 若其持有 `BadgeComponent`，强制触发警徽移交/撕毁流程。
* **狼人自爆 (Werewolf Interrupt) [重点：中断总线]**：
  * **Tool**: `self_destruct(reason)`。
  * **钩子开放**: 在白天【警长归票前】的任何合法 Action Window 中允许调用。
  * **系统劫持**: 一旦触发，立刻停止白天的流转（打断剩余发言与投票），标记该狼人死亡，调用 `PhaseManager.jump_to("night")`。

---

## 🚀 研发 CheckList (按层级划分)

为了跑通这两个板子，您需要开发以下基础组件和接口：

### 1. ECS 数据层准备 (Entities & Components)
1. `RoleComponent`: 存储底牌与初始技能量（如女巫的药剂数量）。
2. `CampComponent`: 标识好人/狼人阵营（用于胜负检测）。
3. `AliveComponent`: `true`/`false`。
4. `VotingRightComponent`: `weight: 1`。白痴被投后移除，警长修改为 `1.5`。
5. `StatusMarks`: `GuardMark`, `WolfKillMark`, `HealMark`, `PoisonMark`。

### 2. 核心状态机开发 (Phase Manager & Events)
1. **流程控制器**: 实现 `start_night()`, `start_day()`, `start_voting()` 循环。
2. **夜间流水线**: `狼人战术交流` -> `守卫` -> `狼刀投票` -> `女巫` -> `预言家`。
3. **结算系统 (`DamageResolutionSystem`)**: 实现同守同救失效、毒药绝对致死逻辑。
4. **事件总线拦截器**: 实现白痴免死判定、猎人濒死索求射击目标。

### 3. LLM 接口与网关层 (Agents & Tools)
1. **动态 Prompt 组装器**: 读取实体组件，生成系统设定、状态告警与视野信息。
2. **Schema 注册器**: 为大模型配置 `check_identity`, `use_potion`, `guard`, `self_destruct` 等 Tools 的 JSON 描述。
3. **错误反弹机制**: 当大模型试图乱放技能（如女巫自救、守卫同守）时，引擎返回明确的 Error 让其重试。

### 4. 记忆管理 (Memory)
1. 保证每日 `[玩家X]` 发言的精准挂载。
2. 实现基础的 Token 截断或摘要机制，确保 12 人局进行到第 3 天及以后不会爆 Token。

---
*建议：先完全使用本地代码（Mock LLM）模拟各种 Tool 调用，确保 12 人局的“白痴被推”、“猎人吃毒”等状态流转与打印日志 100% 正确后，再正式接入真实的 OpenAI SDK 接口进行大模型博弈测试。*

## 2. 开发任务清单

1. 将本文件拆解为可执行任务卡：
   - Phase 流程任务
   - 角色任务
   - 网关校验任务
   - 结算回归任务

2. 为 6 人局和 12 人局分别构建：
   - Mock LLM 回放脚本
   - 标准日志断言模板
   - 失败场景重放脚本

3. 将研发 Checklist 绑定到本地预检流程：
   - 未完成条目禁止进入下一阶段开发任务。

## 3. 验收标准（任务映射）

1. 6 人局验收：
   - 连续运行可稳定完成胜负闭环。
   - 守卫同守校验、狼刀与守护抵消逻辑正确。

2. 12 人局验收：
   - 白痴被放逐后免死且失去投票权。
   - 猎人吃毒闷枪、合法死亡时可插入开枪阶段。
   - 自爆能在合法窗口中断并跳转夜晚。

3. 工程验收：
   - Tool schema、网关校验、事件总线与阶段管理一致运行。
   - 第 3 天后上下文仍可控，不出现 Token 爆炸导致的流程中断。
