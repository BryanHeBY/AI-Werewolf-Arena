# 死亡 hook 的具名运行贡献

## 实际边界

本批基线为 `b6d4a7adf96eee0130540b7b4e25e853b144471f`，保存六个已存在源的真实 Git 字节及八个控制文件。最终范围八源：通用 hook 注册、运行贡献契约、狼美人 hook／完整贡献 owner／公开端口、死亡结算器和两个定向测试文件。

`DeathHookResult` 不再持有 `CharmBinding`。它只持有有序的运行贡献引用；当前唯一生产者仍是狼美人，不为抽象增加其它角色。一次 hook 的 proposal 批量由本族闭包持有，领取回执留在该闭包。`relation` 的 WeakMap、原体／生命／来源政策检查以及 `resolved`／`applied` 写权完全不迁移。

通用贡献在原准备时点运行，返回关联描述 `targetId`、`addedCauses`、`publicAdditionalDeath` 与同步发布回调。它不是 JSON、付款证明或新许可，不冻结库存，也不建立第二状态仓库。World 仍是具体权威要求的原对象身份；只读类型不意味着运行权限隔离。

## 顺序与失败前缀

每个 hook 仍按 **await 当前 hook → 同步准备、标死及发布 → 聚合结果 → 下一 hook** 执行。不能把贡献推迟到整个列表聚合之后。通用索引只处理关联描述和既有时点回调，不拥有来源政策、夜间旗标或关系付款。

狼美人仍先领取，再读取夜梦保护。护梦方法 callee／receiver → World → 目标 → seen 的原顺序由惰性目标查询保留；日间旗标为 false 时不读保护。提供的保护查询仅装配当前实际狼美人路径，本族决定是否使用，不据此统一其它关系的保护政策。

完整批量准备后才按原 `triggers.map` 时点读取目标并建立描述。结算器的两个旧特例同时退出：已 seen／settled 的目标合并描述声明的 `addedCauses`；该额外公开标记 `publicAdditionalDeath` 与原梦牵连／无枪来源等其它公开条件共同决定公开追加名单；false 不否决其它原条件。具体狼美人声明 Charm 原因及公开关联，原提案数组、原因合并和夜间来源由原实际步骤决定。

实际标死及公开追加事实之后才调用本族发布回调，仍由 relation 验证原 claimed 回执与目标真实死亡，再提交 applied／发布事件。保护或事件读取抛错保留已领取、已死亡或已 applied 的前缀；原错误不吞没，后续 hook 不运行。梦死亡记录、permit 关闭和外层 finally 仍由结算器按原位置执行。

## API 变化与验证

退休 `DeathHookResult.charmLinks`、`WolfBeautyDeathWavePublication` 公开构造／prepare／publish 接口、公开 `CharmDeathWaveTrigger`，以及结算器原私有字段。具体原查询 `CharmBinding` 的族内公开端口仍有实际消费者，保持。新 factory 和两个 phase 方法改变调用形状、分配与函数栈；旧自定义 charmLinks 注入不作为隐式兼容路径，不声称任意外部多贡献或 monkey patch 机械等价。

旧三个 owner 测试的输入真实迁入新 API。退休的绑定／回执结果字段断言改为公开关联描述与原 binding.resolved；其它轨迹、错误、生命周期与事件预期保留。这是测试表示变化，不称测试整程序字节相同。

有界执行为新增三例和实际 API 迁移三例合计 **6／50**；另一个原真实 resolver 精准例 **1／7**，五项过滤。两次执行各不重复，合计七个不同 case、57 断言。八根有限类型检查 session `24092` 的实际终止 `bc5b67` 为 0。首职责检查只有新契约时点词项缺失，精确中文说明后仅该失败源复查为 0，未重复其它已绿项。

完整源码比较使用当前 owner 的全部领取／阻断／提案写入和 applied／发布算法；通用接线、保护查询和后置描述另以完整字面程序核对，再作明确的单一生产者接口逆。十个完整区域共 11,557 节点及二十个完整擦除后程序树相同；原始输出十二份相同、八份因布局不同，原始 false 保留，不伪称全字节相同。首两个证明脚本失败是模板尾逗号及布局验收问题，历史报告保留，不修改玩法求绿。

两个命令仍指向原 relation 函数；owner 仅 type-import 它们，通过 hook 提供的晚 getter 取得原 live binding、裸调用。新 owner 的 49 模块有界值图无回到 relation／hook／ports／DR 或 AI 的路径，八个控制文件字节保持。不是全仓冷加载等价或全量门禁。

[紧凑证据](generated/typed-death-contribution-evidence.json) 引用真实 before、完整证明、端点／有界图、收据和最终八源 SHA。未修改录制或回放 schema、历史指纹／金样本；新源码自然产生新指纹。NightStageState 的其它私有类型、广泛运行查询及其它关系边界仍是后续工作，不宣称全 I03／P5 完成。
