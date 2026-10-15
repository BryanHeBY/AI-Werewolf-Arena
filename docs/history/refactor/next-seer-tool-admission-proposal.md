# 普通查验工具准入组合：I04 候选方案

这是只读方案，尚未修改产品或测试源码。盘点时实际 HEAD 为 `e38a36fd7cd12937a08b1cc75dad85e875f3eda2`；后续实施需要重新保存当时真实 Git 和工作区字节，不把其它并行提交混入本笔。

## 实际职责与入口

`backend/src/game/mechanisms/roles/seer/profile.ts:65` 的 `runtime.validationRules` 仍直接组织完整 `check_identity` 准入：实际活跃实例、阶段、工具名、学者／导师削弱、目标存活、预言家终身目标政策、幸运／黑市行动者历史。它直接导入 `scholar_mentor/night_frame.ts`，基础角色声明因而承担跨族业务。

真实入口是 `ToolGateway → ActionValidator → ToolValidationRuleRegistry.validate`。注册表先在构造时从 `RoleCatalog.allRuntime()` 聚合规则，再在调用时优先晚读当前角色的 `runtime.validationRules[tool]`，缺失才用构造时聚合的全局回退。不能把这两种时点概括成“规则全部晚读取”。`buildDefaultRules` 原先先检查一次 `profile.validationRules`，再交 `Object.assign` 读取一次；本笔不改它、Catalog 或自定义 profile 协议。

目前唯一普通 `check_identity` 校验 callback 就在上述 Seer profile。其旧可调用路径是 `SEER_ROLE_PROFILE.runtime.validationRules.check_identity`，没有独立命名的校验函数出口。现有直接 profile 导入是内建登记、预言家政策单元测试和默认板子 Tape 场景；它们继续用同一 profile 对象。观测机器人同名 handler 和 LLM 修复的 `check_identity` 是不同职责，不迁入准入 owner。

## 最小实现范围：三源

| 路径 | 实际改动 |
| --- | --- |
| `backend/src/rulesets/seer-tool-admission.ts`（新增） | 拿走完整原规则表与 callback，公开 `SEER_VALIDATION_RULES: ToolRuleMap`；查询具体能力、预言家目标、学者削弱和行动历史，返回原首个拒绝或 null。 |
| `backend/src/game/mechanisms/roles/seer/profile.ts` | 将原内联规则表换为同一 `SEER_VALIDATION_RULES` 引用，删除该迁出程序专属导入，中文头明确这是资料／配置／运行贡献的声明装配根。其它配置、init、工具、stage、修复、baseline 与展示全部保持。 |
| `backend/tests/unit/rulesets/seer-tool-admission.test.ts`（新增） | 只验证迁移新增边界：表与 profile 的引用、注册表读取时点、动态实例资格与原 getter／首失败轨迹。预期使用手写字面，不生成生产镜像。 |

`seer/ports.ts` 已经拥有真实 `seerTargetAllowed` 实现，无需另造端口。新组合直接消费它和 `scholar_mentor/ports.ts` 的原 `scholarMentorBlocks` 同一函数绑定；能力与历史查询仍来自既有共同 owner。不新增 service／registry／lease，不把完整 callback 隐藏成仅转发学者查询的包装。

新规则表通过具名 ruleset 模块公开，profile 是声明装配根，因此可引用这个组合；普通阶段不反向导入 profile。不给 `rulesets/index.ts` 加根级再导出，避免扩大默认冷加载。真实值图必须核 `Scholar ports → night-lifecycle/night_frame`、`Seer ports → state-slot/prepared-native-install` 的可达边，不宣称端口路径天然没有初始化副作用。发现新回边应修真实装配关系，不放宽 gate。

## 保留完整算法及读取顺序

1. callback 参数仍按 `world → actorId → role → toolCall → day → abilityId → phase` 解构，不能先读取工具名或缓存上下文。
2. 先调用 `activeNightAbility(role, "seer_check", day ?? 1, abilityId)`；缺实例返回 `SeerOnly`。不加 `role.role === Role.Seer`、来源为 native 或拥有某个标签的条件。
3. 阶段错误先于工具名错误；随后才查询 `scholarMentorBlocks(world, day ?? 1, actorId, "check")`。原板子不存在时通过，原未开启／未 settled／原体变化抛错直接传播，不改成 `CheckTarget` 或补读后续目标。
4. 削弱之后才检查存活目标、`seerTargetAllowed(ability.state, actorId, target_id)`、`luckyTargetAllowed(...)`；保留三处 `toolCall.args.target_id` 的独立读取和原 `ability.state` 读取点，不能合并为 `const targetId`。
5. 依次保留 `ModifierUnavailable → CheckTarget → SeerTargetPolicy → LuckyTargetRepeat` 的首拒绝和最终 null；所有错误枚举／字符串、文案调用链不变，不捕获或改写 getter 异常。
6. 完整规则表仍可写，profile 持有同一引用；不 freeze、spread 复制或 bind callback。Registry 调用保持裸 `rule(ctx)`，不新增 profile／table 作为 receiver。

原 `activeNightAbility` 依据实际库存及 status 选择；默认选择原生，显式 `abilityId` 可选受赠／复制／转移实例。其 suppression 描述符、起效／到期／次数／当夜使用检查全部留原 owner。`seerTargetAllowed` 的 fresh policy 使用原实例终身历史；`luckyTargetAllowed` 还会依据同一行动者的库存和本地历史限制目标，即使相关幸运实例已经过期、耗尽或转移，也不在本笔重置历史。

本笔不能把“必须行动”迁成工具准入规则：`seer/night_stages.ts` 仍先求 legalTargets，没有合法目标不建请求；`ability.state.actionPolicy` 仅在原请求位置决定 requiresAction。普通、幸运和黑市 stage 的重试／付款／状态写／子狐效果／当前生命与 scope 复验保持原 owner。蚀日侍女复制的 `seer_check` 同样保留既有库存与回退校验路径；机械狼的 `mechanical_inspect`、角色查验和猎魔人封存控制器不合并为这一工具。

## 定向验收及限界

- 新有限例一：同一可写表绑定与真实 `RoleCatalog/ToolValidationRuleRegistry`。在构造后替换原表 callback／通过 getter 读取，明确验证“当前 Seer 规则晚读”与“其它角色的全局回退保留构造时 callback”不同；finally 恢复测试修改，不改全局生产默认实例。
- 新有限例二：真实库存的非 Seer 行动者与指定受赠 `seer_check`，验证不因角色标签拒绝、无资格先失败、目标历史限制保持。使用原 `grantNightAbility`／组件装配，不以空对象假装已授权库存；不写赠送政策、次数或强制请求规则。
- 新有限例三：上下文 getter 解构、阶段／工具的短路、晚目标读取与首个异常；用手写 trace／独立异常对象，不复制完整生产实现来生成预期。若前两例已完整覆盖这些风险，则不为数量再加重复例。
- 旧精准案例仅必要一次：`lucky-ability-resource-boundaries.test.ts` 的 `Lucky check acts only in late slot, shares actor target limits with native check, and preserves independent resources`，验证同名工具的原生／赠送资源和历史共同路径。原政策矩阵、Tape、所有角色整局不重跑。
- 有限类型一次：实际三源和上述旧精准案例 root；删除导入不算新编译 root。不为了纯规则表移动再跑全类型／全 gate。
- 保存真实 before、实际完整原规则表与新 owner body 对照、整个 profile 保留程序与导入绑定、首失败／收据、最终 scope SHA。公开新表路径和加载图变化单列，不声称任意 CJS 导出重赋或全部反射 API 完全等价。

新 owner 的中文头应说明“准入不是执行／付款／租约”；重要逻辑就地解释动态技能不按角色标签裁决、削弱查询先于目标、历史归行动者、可写表与两种注册时点。profile 头说明声明装配根，测试头说明单元层级及字面独立预期。机器工具名、规则错误、政策版本、原英文用户文案和测试标题保持。

## 后续独立审查

功能审查核动态库存、requiredAction 与资源／历史边界；轨迹审查核完整原 callback、getter／callee、短路和失败前缀；架构审查核真实公开端口、可写表身份与新增冷加载图。三者都只审本笔源，不以完整 body 移动或类型通过替代行为边界审查。本方案不声明 I04 全部完成。
