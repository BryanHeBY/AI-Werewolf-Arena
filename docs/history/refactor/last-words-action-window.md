# 完整遗言行动窗口归属

## 实际范围

- 开工 Git：`4e5937fd05d426f80be17487de52e4a602936cff`。
- 三源：`engine/death_resolution.ts`、新 `mechanisms/last_words/window.ts`、新 `unit/mechanisms/last-words-window.test.ts`。完整前样只有一个旧程序，另外两个路径在开工 Git 与采样工作区均不存在。
- 原 `collectLastWords` 含其说明与声明共 93 个物理行；迁移的是完整方法。DR 五条精确编辑仅涉及类型／窗口 import、惰性窗口字段、实际 await callee 和旧方法退休。
- 稳定控制为原遗言政策机制、World、请求工厂、ToolGateway 及中立行动端口。并行 PM、Noble、Demon 源不算本批不可变控制，也不宣称传递闭包是固定开工 Git。

## 所有权及原顺序

`LastWordsWindow` 直接持有完整收集程序：构造请求工厂、逐人政策判断、开放许可、构造请求、等待、清洗校验、回复后复验和发表／关闭。DR 保留原默认遗言机制 singleton、整波标死与来源阶段、授予事实、唯一 collection await 及随后警徽／钩子／枪顺序。窗口不计算胜负或重写政策，也不创建第二份许可、库存或账本。

窗口构造只保存原运行依赖对象，DR 装配只捕获自身。必填 `ActionRequestFactoryConstructorPort` 在 collect 入口晚读取，接着按原表达式顺序读 World、事件数组与第一次 state.day；独立 new 完成后另读本次收集日期。工厂输出的请求只是数据，World 仍核原生命对象、版本、当前性与许可字段。原工厂值 import 仍服务 DR 的死亡枪装配，并未误删。

逐人先读取来源阶段，再调用原 shouldGrant；不符合政策则跳过。当前性／阶段／日期／终局检查仍在原点。openDeathAction 位于 try 外；开放成功后，request.create、provider await、gateway 及其后复验与发表都在原 try 内。无 speak 或未通过网关继续下一人，作用域失效返回整个窗口，二者均执行原 finally。

发表保持 events.push callee → Date.now → player／phase → 当次 state.day → 清洗后 args.text；读取／发表错误不回滚前面的动作。finally 直接读取并调用 permit.close，不聚合或吞错。close 抛错仍覆盖正文正在传播的错误，World 自身的许可身份及关闭规则原样保留。

## API 与静态证明边界

新增具名类、运行接口、DR 窗口字段和公开 collect 方法；原私有方法退出，不保留转发桥。依赖字段经 runtime getter 传回同一对象，其 readonly 只是类型写法，不冻结输入或拍摄快照。新增类／字段初始化、getter 委托、方法查询与调用栈是明确可观察面，不宣称任意私有反射、prototype／CJS 重绑定或整个冷加载图等价。

准备的证明核 DR 完整五编辑正逆、实际新九参数方法及整个 resolve。新方法只映射六个具名 runtime 字段路线和 constructor 标识符；整个 resolve 只映射一个实际 callee，九个参数树原样保留，不将新 body 换成旧 body。whole DR 的 raw 相同仅指精确逆向；actual DR JS、类布局与新模块 API 本来不同。命名绑定证据只称模式／名称／解析模块端点，未递归宣称所有最终物理声明。

## 新风险与检查阶段

两项独立字面输入均使用真实 bootstrap、请求工厂、ToolGateway 和 World 死亡许可：

1. 窗口装配不读依赖；入口构造／两次日期读取的字面轨迹，实际挂起 provider 后替换原生命，迟到回复不得发表，许可关闭。
2. 真实 speak 清洗／校验后发表 sink 抛原错误，close 先关闭真实许可再抛另一独立错误；核最终错误优先级、发表参数及已完成的死亡前缀。

Root 在四组联合 SourceFence `7d05bae3` 后首执行，作者没有执行检查：

- 新两例 `fe3062`：2 通过、0 失败、22 次 expect，未重跑旧用例或本次绿例。
- 三头 `55af45`：719 个当时同 Git 文档路径、0 诊断。
- 完整证明 `250f2b`：5 条 DR 精确编辑；实际新方法 24 个具名运行字段路线；完整 DR 逆向、完整迁出方法映射、完整 resolve 单 callee 映射各 ES/CJS 两输出，共 6 个比较输出。49 个保留命名绑定模块端点、10 个迁出类型模块端点与 5 控制均核同；累计比较两侧 12976 个 typed 节点、1978 个 NodeArray、6560 个 forEachChild 语法叶。计数不是业务覆盖数或全部 lexical token 数。
- 联合 12 根类型首 `092650/session64038→c3b6ea` 实际退出 2：仅另两批新 unit 的 5 诊断，本批三源没有诊断。Root 只修这两个失败 unit，并以 `89b65c/session70497→ac39a5` 有限两根检查退出 0。没有把它称作末全 12 根重跑通过，也未运行本批备用 finite3 配置。

共同 Root 收据为 `generated/noble-dawn-lastwords-demon-joint-type-receipts.json`（SHA `832908b6`），首 fence／两配置／完整输出／两个后继失败夹具及一条 Noble 中文说明的阶段均原样引用。

SourceReady 中 checksRun=false 是首源码捕获时事实，保留原字节；后继执行与共同首／失败根阶段由 receipts 绑定。全程没有业务旧绿、模型、全量类型或架构门禁重复。

编辑准备曾因错误预期方法片段含尾换行而断言停止，失败发生在写任何源之前，实际输出保存在 edits.preparationHistory；仅修捕获边界，不改程序凑工具，也不记为产品或证明失败。
