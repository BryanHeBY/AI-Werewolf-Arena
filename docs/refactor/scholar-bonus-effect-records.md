# 学者／导师加成运行记录归属

基线为实际 `2a2e447aaab16219508dea759e4a8eaf7971187b`。本批只改通用夜间契约、本族夜间阶段，新增本族 `bonus-effect-records.ts` 与一个有限单元，共四个源码路径。原两源全文和五个原控制文件的 SHA 见 [before](generated/scholar-bonus-records-before.json)，逐源冻结见 [scope](generated/scholar-bonus-records-scope-final.json)。并行 PM、死亡贡献与 Noble 候选不作为本批全字节控制。

## 单一运行所有者

原 `NightStageState.modifierBonusEffects` 仅有一个通用声明、本族阶段一次读取和两次追加，没有归档、前端或其它生产消费者。通用声明却反向包含私有 `ModifierBonusKind`／`ModifierBonusReceipt`。现删除该字段，由本族唯一 `WeakMap<NightStageState, ScholarMentorBonusEffectRecord[]>` 按原状态对象身份保存原数组。

本族 owner 只提供读取及申请追加数组两个具名接口。未写入时读取返回临时空数组，不预建记录；第一次申请追加才建立唯一数组，此后取得同一引用。记录的 kind、receipt、可选 marks 三个字段保持原类型与可写性。回执／印记保留原引用与各自写权，具体回执的只读契约及运行冻结仍归 frame；只读数组视图不增加深冻结，也不授权付款或行动。

原 assert 函数、阶段前后及伤害前检查点保持原位。唯一三处 slot 接线改变：

- 读取在原 `ctx.state` 求值点取得本族数组，再逐条读取 target、effectCurrent、目标生命／版本及可选 marks。
- 两个写点先申请数组并解析原 `.push` callee，再创建同一个效果条目；没有把条目构造提前到 callee 之前。
- receipt.commit、查验事实、ensureMarks、毒来源和印记、刀口列表、事件发布以及原错误前缀完整保留。

这里不移 assert、纯 DTO 或 GC，不增加通用 store，不在旧属性上镜像或双写数组，不改变 modifierDeaths／modifierKnifeTargets、付款、生命周期或伤害算法。换一个同形状态对象不携带旧数组；原数组不会因查询失败而清理或退款。

## 明确的存储／API 迁移

这不是只改类型名称，也不声称任意旧外部输入完全等价。旧公共字段允许手写数组、属性 getter／setter、原型或浅复制继承注入本族回执；这些属性与反射路线退出。新 owner 不读取这些旧字段，调用方须用本族运行接口。同名旧属性不成为付款、当前性或 owned 来源。

[真实旧行为](generated/scholar-bonus-records-legacy-characterization.log)在源码修改前调用实际旧 assert：外部 getter 注入记录，轨迹为 `state → slot → target → current`，最后返回原 `scholar_mentor_bonus_effect_stale`。新单元分别验证新状态身份及退休 getter 不再被调用；没有把原反例改写成绿色旧 API 兼容承诺。

数组／记录物理属性位置、WeakMap 查找和新函数 callee、反射及模块来源变化是本批实际 API 差异。旧 raw claim 的其它 legacy 接受政策不改；通用头说明已限定到原毒／机械／觉醒注入，避免声称被删除的本族属性仍受支持。

## 有界证明与实际收据

[程序证明](generated/scholar-bonus-records-proof.json)从真实 before 与实际候选开始，只逆唯一新 import 和三处已核 slot 接线：完整阶段 1,261 节点、完整契约 519 节点及全部非注释叶保持；两份阶段输出、两份契约输出 raw 相同，契约实际类型擦除输出也相同。新 owner 完整读／写方法与三字段结构按实际全部语句核对，唯一存储为原状态 identity WeakMap，只有三个 type-only imports，无 World／回执调用或第二存储。类型单元双向验证原三字段，包括可选 marks 及嵌套各自读写约束。

五个实际控制源完整字节与固定 before 相同，保原 frame、Pipeline、伤害组合、StatusMarks 和既有 frame 测试。新 owner 的实际 ESNext 输出没有运行时 import/export 依赖，因此没有引入角色运行模块反向初始化边；这只是该新叶的有界结果，不是整个图零循环声明。

[收据](generated/scholar-bonus-records-receipts.json)保真实执行顺序：

| 检查 | 实际结果 |
| --- | --- |
| 新单元一次 | 3 通过、0 失败、25 次断言，`508478` |
| 首有限四 root 类型 | session89289，终止 `bd2eea`，退出2；唯一新单元 matcher TS2769 |
| 仅失败新单元 root | session56184，终止 `1e32b0`，退出0 |
| 完整程序证明 | `792e23`，退出0 |
| 最后两注释桥、职责及中文头 | `d14043`，退出0；四源、当时469个跟踪文档、零诊断 |

新单元证明惰性唯一数组、同记录／receipt／marks 引用、状态替换隔离、原 target→callback→life→marks 顺序、当前性／marks 拒绝及旧 key 静态负例。commit 是失败哨兵，不使用原生产结果生成预期，也不运行整局或模型。

首类型失败仅因旧 key 编译负例的 matcher 同时被泛型窄类型拒绝；增加 `as string` 只做类型擦除，原输入及断言不变，两份整个单元运行输出相同，原三源类型根和已绿运行单元不重跑。首证明工具用无尾逗号的手写新 helper 模板匹配带尾逗号的实际签名导致失败，随后仅校正工具模板和布局，未改生产算法。独立审查指出回执可变性说明过宽，最后仅修两条中文说明；[注释桥](generated/scholar-bonus-records-peer-comment-proof.json)保存完整叶及四输出到最终 SHA。

本批没有全量类型、原套测试、完整对局、模型或架构门禁复跑，不关闭整个 C17/I03 或 P9。新源码／注释位置会影响新构建指纹，历史指纹不重写。冻结后由 Root 与独立代理审查、按功能提交；本作者不提交 Git。
