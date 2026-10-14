# 雾鸦延迟夜的具体结算序列

本批对应 C24／C28，仅修改 PhaseManager，新增一个具名规则所有者和定向单元，共三源码。正式 before 来自 `27df6552992404dbb1783917cbdaeeaa27e45de3` 的真实 PM；六个本族／生命周期／已提交 NightPipeline／旧场景控制均同此 Git。并行 DeathResolution 的关系贡献重构不作为整文件控制，本批真实死亡调用及其完整参数仍纳入 PM 程序证据。

## 真实职责和恢复时点

原延迟夜建立段全部迁入 `prepareMistDelayedNight`：先复验雾鸦名单，再依原交接名单逐项核生命引用、alive 与版本，最后在原参数顺序构造 MistPendingNight。经理仍在同一字段保存返回的原实例；规则集没有第二份 pending、资源账本或完成标志。字段类型使用实际构造函数的 ReturnType，没有旧类型转发叶。

`settleMistDelayedNight` 是此具体流程的同步生成器，收完整 pending 读取、缺失拒绝、原 current 闭包、领取、蛇选择、最终伤害准备、记录、复验、finish 与正常 close。只有两个交回点：

1. 交原 `decideSnake` Promise；经理在原第一个 await 等待。拒绝不恢复伤害准备。
2. 同步交原伤害及同一个 current 函数引用；经理发表原夜报，并在原第二个 await 等待真实 DeathResolution。只有成功返回才再同步恢复名单检查、finish 和正常关闭；失败不自动推进完成段。

PhaseManager 保留原两个 await，公开夜报、真实死亡参数、来源夜、梦句柄、毒证据及执行单位／修订号都在原调用点。阶段时钟、唯一 pending、nightSettled 赋值、胜负检查、自爆前提前 claim、周期 abort／清空和外层 finally 不迁移或包装。没有 async 转发、额外 Promise 完成等待、通用 runner 或补偿机制。

领取先于原蛇窗口，疗救仍由原机制付款。蛇成功但死亡失败时，原付款、已经发表和标死的前缀保留；经理的外层 abort 仍收尾。原 finish／close 任一步失败不会设置 nightSettled 或进入判胜。

## 有限验证与来源

- 从当前完整 factory 和生成器读取全部主体，精确逆四类属性查询、两个明确交回点以及原运行接口：建立段96节点、完整 settle闭包232节点相同。完整新 PM 展开这两个实际主体后再逆接口／类型导入，6,207完整节点、全部非注释叶与六份完整 ESNext／CJS 输出同；不以旧整个 body 覆盖新所有者。
- 15个原具名绑定逐声明追到同一物理端点，95个经理保留绑定不变；新增 NightSummary／DreamNightEffects 只声明实际读取的纯类型，不迁运行状态。六个控制全字节保持。原场景中9个 `mistPending.status` 反射读取点、标题、错误与断言字节保持，不将其称作九个新执行用例。
- 新三个不同风险用例最终通过：旧交接版本先于伤害／梦读取拒绝；同步交原 Promise、完成真实死亡后才正常关闭；蛇疗救已付款后死亡 await 失败保留付款与标死。首模块因误猜状态 reader 名称而无法加载；首实际执行两个通过，另一个输入先触发原名单撤销。只修新 fixture 的交接版本，不改原预期或生产检查，仅重跑失败用例。原真实提供者失败的精准场景单独一次通过，6断言／20过滤。合计四个不同用例，29个成功断言；首失败断言另留，不混称一次四例。
- 四根有限类型首检查只有新单元四处类型错误：readonly写视图、抛错 getter 的 void 推断和 privateState 的 object 形状。精确类型视图／never／raw形状注解保持单元两完整输出相同，随后仅失败单元根 session44478／bf48a9 真正退出0；原三绿根和运行绿用例不重复。
- 三源实际职责头及中文检查零诊断，文档路径522。检查采样在类型修复前，单元完整头字节保持的类型桥已登记，不伪称重新执行门禁。

[原输入](generated/mist-delayed-night-settlement-before.json)、[完整源证明](generated/mist-delayed-night-settlement-proof.json)、[真实收据](generated/mist-delayed-night-settlement-receipts.json)、[类型桥](generated/mist-delayed-night-settlement-type-fix.json)、[冻结范围](generated/mist-delayed-night-settlement-scope-final.json)与[证据目录](generated/mist-delayed-night-settlement-evidence.json)持久可核。首捕获器误要求并行 DR 全字节同固定 Git、设计阶段主动阻止重造 current 引用，都按真实工具失败留存，未用来源伪装消除差异。

## API 与边界

新同步序列、额外 getter／交回记录、函数栈和 ReturnType 归属是明确内部 API／分配变化。原 pending class、Snake、frame、生命周期和死亡权威不改；保留旧反射读取不意味着任意私有方法调用或外部自定义 runtime 都与旧实现等价。current 是原运行闭包，不是 JSON、权限品牌或复制的阶段时钟。

只查看实际源码与必要定向验证，没有全量门禁、完整对局、模型或全角色矩阵；不是整 C24／C28 或最终 P9 完成。本批不改 DR、NightPipeline、Git、progress、共享矩阵、私有配置、golden 或旧场景断言。
