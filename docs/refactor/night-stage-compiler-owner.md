# 夜间阶段编译的职责归属

## C21 准备切片

既有 `NightStageRegistry` 全部算法迁到 rulesets 的 `night-stage-plan.ts`，NightPipeline 直接消费真实 owner。旧机制目录仅具名重导出同一个 class 与默认 singleton，不保留另一份算法；该兼容入口按 C44 退出。

输入仍是 BoardConfig、实际 RoleCatalog 与可选当前 World；原一遍声明能力扩展、当前能力查询、赠枪激活、幸运/黑市后置行动、去重及 priority/id 排序保持。Ghost Bride 的四项替换操作保持原位置和原顺序。没有冻结 actor、能力实例或 handler，也没有变更任何 stage 的执行 receiver。

这是实际装配算法的模块归属迁移，尚未引入 immutable RulePlan，也未把未声明的碰撞改为错误。原 first-wins 行为仍保留；潜在能力闭包不能在本笔悄改为 fixed point。下一切片分别落计划 metadata 和共享/替换/冲突声明。

## 证据

原 registry 全部非 import 声明、NightPipeline 全部运行正文逐字保持；所有 imported binding 的实际目标与 class/default singleton 身份保持。Root 与独立审查核对通过；源码类型检查通过，原商人阶段闭包/顺序相关七项、138 次断言通过。没有重复完整对局。

现有精确指纹递归包含整个 backend/src，新 rulesets leaf 同笔纳入；没有新增 I/O、缓存中的当前游戏或另一份 World。
