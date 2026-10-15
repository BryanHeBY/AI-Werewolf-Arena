# 不可变规则参数

## 目标与策略边界

每个实际 World 只绑定一份经过校验、独立复制并深度冻结的规则数据。引擎、角色初始化、Agent 提示、模拟、复盘记录和事件游标条件必须使用该份数据。调用者对象、World、玩家与 handler 均保持原实例，不冻结或复制。

这是明确的参数策略加强：原实现持有调用者 BoardConfig，跨 await 修改 tieBreaker 会使同一夜的两个 handler 得到 `[5, null]`；新实现应固定为 `[5, 5]`。原有未使用的 cupid getter 可被接受且读取零次，新入口应拒绝该输入，仍不得调用 getter。原输入与原结果保留，不替换样例以隐藏差异。

同一 World 的相同完整参数复用原 owner；不同参数拒绝隐式 revision。取消的直接 NightPipeline 调用仍先执行原 current=false 早返，不取得参数或夜间资源。普通 bootstrap 的参数装配位置在原 fixedRoles 读取、deal fork 之后、首个玩家实体之前，原支持与组牌顺序继续保留。

## 唯一权威与数据边界

参数入口先拒 Proxy，再检查自己的数据描述符；不执行 getter、iterator、继承字段或自定义转换。只校验后的独立数据允许冻结。公共 readonly 类型还必须覆盖嵌套数组和字段，不能靠 mutable cast 给消费者写权。

TypeScript private constructor 和 instanceof 都不足以证明 owner 真实。实际审查已复现伪原型 getter 和 JavaScript 构造绕过；实现必须用模块私有构造 token 与真正实例认证，在接触调用者数据前拒绝非法构造。公共 owner、其类和原型的替换边界也必须收口。

公开 context 中的 parameters 指针不能独立决定录制规则。实际审查已证明，替换它会使 Tape 与 World 绑定不同的 tieBreaker。录制必须取得 World 的唯一 owner 并核对 context 关联；context 的不可替换边界不能冻结 World 或 actor。

## 复盘闭环

现有 normalizedBoard 记录完整参数，runtime owner 只向它提供独立序列化 DTO。修改调用者、返回 DTO 或 recorder 接收的副本均不得改变 runtime owner 或 Trace。runner、simulation、replay 的实际消费路径及游标条件必须全部接线，不能仅让 PhaseManager 持有冻结副本。

若没有参数重编译操作，可以沿用 normalizedBoard 与既有严格 sourceHash、lockHash 和 ruleset 检查；必须用实际新记录写入和读取证明这一闭环。若引入参数 revision，则其 writer、reader、版本处理必须同笔完成。旧 sourceHash 记录不得重写或放宽验证。

既有 metadata 中实际影响循环的标量，例如 maxDays，也必须在原 metadata 属性求值位置捕获并复用，避免记录值和执行值背离。displayLocale 继续是输出层的临时选择；计时器、截止时间和后台任务所有权不借此调整。

## 验收要求

保留旧 getter、跨 await、构造和 context 指针反例；新增真实新源写入/严格复盘收据、只读写入编译负例、原 World/actor/RNG 引用和普通规则结果检查。本批的实际调用方、数据编码、精确源码映射、责任头与三方面审查已经收口；只交付不可变参数边界，不代表完整 RulePlan 或 P4 已完成。完整阶段与最终同源门禁仍按实施计划执行。

## 保持原拒绝顺序

数据描述符检查和独立 clone 之后，入口只检查原板子判定需要安全读取的根对象、角色行数组和胜利条件数组。随后执行原有按顺序的板子判定，最后由完整 schema 决定是否能够创建 owner。这一步的结构资格不表示参数已经合法，也不授予运行能力。

独立审查发现，先做完整 schema 会把原 Fragrant 的 `awa_day_deaths_v1` 输入从 `fragrant_pair_seer_preset_invalid` 改成参数错误。本批已恢复两个原 Hunter 输入的原拒绝前缀，保留首次失败证据；缺少角色数组、非法角色行等输入则明确拒绝为 `rule_parameters_invalid`。没有用通用 catch 吞掉板子判定自身的异常。

## 已完成的有限验证

- 最终源码范围为 72 个文件。独立核对 31 个只读消费者、7 个主流程的完整运行程序和 28 个维护调用文件；29 个被移除的参数属性表达式仍在原位置求值，未改变原测试输入或执行顺序。72 个责任头通过。
- 原构造绕过、伪原型 getter 与 context 指针污染已用相同原输入关闭。getter 零调用，调用者未冻结，伪实例和外来 context 无法选择录制规则。
- 维护测试覆盖嵌套冻结、独立 DTO、同 World 参数复用、不同参数拒绝、跨 await 固定规则及编译期只读写入负例。有效的零数量角色行没有受到无关事件容量限制。
- 原始 `witch.unused` 坏输入保持，维护期望明确反映更早的 schema 拒绝；原 getter 输入保持，期望明确反映新数据边界的零调用拒绝。
- 八项参数和零决策复盘测试通过，共 40 次断言；新增原板子前缀与坏结构回归一项通过，共 6 次断言。原坏字段维护用例一项通过，共 3 次断言。最后的有限类型项目在新增结构资格检查和维护回归之后实际退出 0。
- 零决策测试使用惯性 manager 和真实 Trace、严格 reader；另一个原固定发牌用例实际创建 SessionRecordManager、推进对局、落盘、读取 JSON 并严格复盘，一项通过，共 3 次断言。两种证据范围明确区分。最终结构资格检查版本另有一项零决策写入/严格读取回归通过，共 7 次断言。
- 六个公开入口的原流程与候选流程共 12 次独立进程冷导入全部成功，导出名称相同；没有调用 CLI main、模型或完整测试套件。

各次收据属于各自的候选输入，后续入口修正有独立源码审查和同输入回归；这些结果没有被合并成最终同源全量验收。归档仍是 schema 2，旧 sourceHash 拒绝未放宽。完整 RulePlan 的工具与阶段声明、其他生命周期、判胜计划及机制矩阵继续实施。

提交范围和有限证据摘要保存在 [owned-board-parameters-evidence.json](generated/owned-board-parameters-evidence.json)。
