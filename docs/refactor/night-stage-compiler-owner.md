# 夜间阶段编译的职责归属

## C21 准备切片

既有 `NightStageRegistry` 全部算法迁到 rulesets 的 `night-stage-plan.ts`，NightPipeline 直接消费真实 owner。旧机制目录仅具名重导出同一个 class 与默认 singleton，不保留另一份算法；该兼容入口按 C44 退出。

输入仍是 BoardConfig、实际 RoleCatalog 与可选当前 World；原一遍声明能力扩展、当前能力查询、赠枪激活、幸运/黑市后置行动、去重及 priority/id 排序保持。Ghost Bride 的四项替换操作保持原位置和原顺序。没有冻结 actor、能力实例或 handler，也没有变更任何 stage 的执行 receiver。

这是实际装配算法的模块归属迁移，尚未引入 immutable RulePlan，也未把未声明的碰撞改为错误。原 first-wins 行为仍保留；潜在能力闭包不能在本笔悄改为 fixed point。下一切片分别落计划 metadata 和共享/替换/冲突声明。

## 证据

原 registry 全部非 import 声明、NightPipeline 全部运行正文逐字保持；所有 imported binding 的实际目标与 class/default singleton 身份保持。Root 与独立审查核对通过；源码类型检查通过，原商人阶段闭包/顺序相关七项、138 次断言通过。没有重复完整对局。

现有精确指纹递归包含整个 backend/src，新 rulesets leaf 同笔纳入；没有新增 I/O、缓存中的当前游戏或另一份 World。

## C21 阶段成员快照

流水线在原有读取阶段列表的时点调用 `getPlan`，只调用一次虚方法 `getStages`，保留注入子类的覆盖。普通原生、稠密、own-data 数组生成冻结的成员数组和描述 metadata；handler、World、能力实例仍保持原对象且可变，执行仍用 `stage.execute(ctx)` 保留 receiver。metadata 对 handler 只读取 own-data 的 id/priority，Proxy 或 getter/inherited 字段显示 opaque。

计划明确区分 `snapshot` 和 `opaque`。自定义迭代器、数组子类、Proxy、稀疏或索引 getter 等输入保留原 iterable，不提前遍历，也不冻结调用方对象。这样保留 for-of 与 await 的交错、迭代器错误及已有提交前缀。

独立审查发现首版 eager copy 会在自定义迭代器抛错前丢失第一项已执行效果，也无法支持第二次 next 依赖第一项提交。修复代码保留 lazy 执行；两个原红反例在修复版本上分别保留第一项前缀和两项提交。索引 getter 的实际读取也在第一项执行之后。普通数组在执行期间 append 不再改变本次成员计划，是本切片明确的政策加强：旧实现可执行新增项，新快照保持初始成员。此差异有单独维护断言，不登记为机械等价。

新增九项有限测试、63 次断言通过；源码及该测试的有限类型检查通过。既有阶段收集算法、动态角色/资源读取、去重和 Ghost Bride 操作不变；无新增 clock/RNG/current/actor 查询。原阶段闭包与真实中途赠予的两项局部证据沿用，未重复完整游戏。

这仍是夜间阶段成员计划，完整 RulePlan 的参数、支持范围、判胜检查点及共享/替换声明继续 C22 和后续切片。未写入新 checkpoint revision，存档 writer/reader 不变。
