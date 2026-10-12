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

## C22 显式共享与替换

阶段注册由 `night-stage-registration.ts` 拥有。同一个 observed ID 只有同一个原 handler 引用可共享，涵盖既有 wolf_discussion/wolf_kill_vote（各 21 个 profile）、Scholar/Mentor 的五个共同阶段，以及原查验、幸运、黑市和 Demon compiler/profile reservation 重叠。声明没有放宽板子组合，也不比较函数源码或任意对象的 stringify。

不同对象的同 ID 注册现在抛出 `night_stage_handler_conflict:<id>`，即使 priority 和 execute 相同。这是明确政策加强：旧版选第一个，现版拒绝冲突。另一个原动态 getter 反例在第一次 ID 读取为空键、第二次为占用键时曾覆盖已有 handler；现版保持两次读取并拒绝不同对象覆盖。两项原输入及原结果保留，没有用更换 handler 或重生成 golden 隐藏差异。重复项不额外读取 priority/execute；诊断不强制转换外来 ID。

鬼新娘的冻结声明只有原四项有限操作：移除普通狼刀、安装婚礼聊天、安装婚礼刀、已有普通狼聊改 priority 350。原 map/ID/getter/spread 顺序及没有普通狼聊时的行为保持，不建立泛型替换图。

15 项局部、87 次断言，以及原 Ghost 实际阶段一项、3 次断言通过。必要类型、四个职责头、源程序逆向映射及独立原输入探针通过。C21 snapshot/opaque 与原角色、当前能力、clock/RNG 查询保持。十份原工具声明及七项实际阶段/工具关系只构成有限静态证据；完整工具 schema/动态 actor 一致性检查和完整 RulePlan 仍是后续要求，C22 尚不登记全部完成。

## C21 实际执行项与来源

流水线现在遍历 `plan.entries`，每项仍调用原 `entry.handler.execute(ctx)`，receiver、全部原循环正文及 getPlan 的读取时点保持。不是只建立一份未被消费的 metadata。旧 stages 仍保兼容；普通数组的成员加强政策不再扩大。

默认收集在原 role pack 的一次 spread 完成后，仅查看自己的新增数字索引，记录已观察到的 profile 角色或 compiler reservation。共享 handler 合并所有来源。Ghost 仍在原 Map set 的参数求值位置取得原本创建的 clone，set 完成后关联旧引用来源和有限替换操作；不再读 handler ID、priority、foreign pack，也不推测 ability ID 或当前 actor 资格。

来源关联属于 registry 的每个返回数组，用私有 WeakMap 管理，没有全局 currentPlan，也不为标签保留 World。虚方法覆盖、未观察引用或外来角色明确给 unknown。snapshot 项和自己的来源数据冻结，原 handler/World/能力仍是原对象。

opaque 项只包装刚从原 iterator 拉取的 handler，下次 foreign pull 仍在本次 handler 执行之后。yield-throw 与 next 依赖前次提交的两个既有反例保留已付前缀。

八项新增和六项既有注册测试共 14 项、71 次断言通过，原真实中途赠技场景一项、两次断言通过；一次有限类型检查通过。源码逆映射核对原 getStages、Ghost 操作、既有 helper 与流水线全正文，五个职责头通过。本批不冻结 BoardConfig，不新增 checkpoint revision，不声明完整 tool schema 或判胜检查点；完整 RulePlan 仍继续。

独立审查另比较了 opaque 包装与原 for-of 的三种 IteratorClose/错误前缀：执行抛错、return 抛错和已提交后 next 抛错，调用轨迹及错误优先级保持。原/现 plan、pipeline、bootstrap、CLI 的八次 cold import 同成功、同出口；没有重复真实对局或作者的定向测试。
