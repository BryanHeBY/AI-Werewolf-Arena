# 实际消费的执行规则计划

本批落实 P4 的 RulePlan 实际所有权，是 C21–C24 的共同输入边界；不据此宣称这些切片或 P4 全部完成。

PhaseManager 创建并持有一个 `RulePlan`，复用原已绑定的 `BoardParameters`。NightPipeline、BootstrapResult 和记录入口消费相同引用。原生失败／目标／已付效果三项工厂、夜间生命周期组合与四个原封盘名称实际经此 owner 使用，没有第二个 World 全局缓存。

参数仍在原夜间绑定点核对。直接使用 NightPipeline 时，计划也在该点获得参数后创建。首次默认阶段收集仍在原晚时点；不提前读取 World、actor、库存、execute 或选定目标。

## 固定定义与现场实例

默认自有数据贡献首次收集后固定成员、已声明潜在能力、ID 与 priority。之后变更或转为不透明协议会明确要求 revision，当前实现拒绝未支持的重编译。这是对旧可变默认定义的明确策略强化，不能称为相同接受范围的机械迁移。

七种潜在预约只补定义元数据，不强行添加执行 entries。合法晚赠能力沿用原声明闭包，actor、当前能力、库存和实际可选预约仍由原 collector 每夜现场查询。鬼新娘的原替换、去重与排序保持。

初始注入的 collector、Proxy 或惰性 iterator 保留原拉取／关闭前缀。execute 每次通过原 handler receiver 晚读取，不缓存函数。交叉审查发现方法 lookup 与 World 参数求值曾倒置，修复为 owner 内 `registry.getPlan(parameters.board, world())`，保留原 callee 先于 World。

## 记录与验证

记录入口先核对真实 private brand、manager 的同一 plan 与参数，再捕获 checkpoint；归档继续只编码参数 owner 的脱离克隆。没有新增 schemaVersion2 或 revision 字段，运行时计划、handler 与回调不序列化。

九路径（八生产、一测试）由 Root 和两方向子代理审查。七原输入核实际 Git；42 个未触及函数／方法保持，十个明确修改体逐项登记为 owner、caller 或策略变化。严格有限四根类型进程 38790 实际退出 0。

十二个不同新用例分四次执行，合计 12 通过、0 失败、36 断言；没有虚称一次运行全部最终测试文件。原晚赠流水线用例 1 通过／2 断言，真实 native writer 与严格复现用例 1 通过／3 断言。九个中文职责头和重要定义、预约、品牌及 getter 顺序说明已核。

详细证据见[有限收据](generated/execution-rule-plan-evidence.json)。完整工具／状态贡献、效果／死亡扩展、观察与记录迁移及最终固定输入全量门禁继续执行。
