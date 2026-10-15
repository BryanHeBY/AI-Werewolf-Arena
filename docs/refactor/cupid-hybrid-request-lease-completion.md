# 丘比特／混血儿动态请求租约与完成通知

## 范围与政策

本批以真实 `f5ee25e1dc9a04a047c9a063aca4ec27f295e08f` 捕获三个旧源码和新单元的不存在状态，独占现有 `core/domain/request-lease.ts`、两族 `night_stage.ts` 与一个真实窗口风险单元。原四种协议、原体／付款／关系／成员 owner 不迁走。LastWords 的窗口接线由另一个作者负责，消费同一个新入口，不建立第二租约。

这是独立 F02 行为修正：新增动态 actor／phase／day／stage 查询、envelope pin、领域／时钟观察及延后 settlement，改变原接受和异常时点，不称机械等价。现行源码身份按真实内容变化，严格录制不能豁免新 sourceHash；历史归档原文和身份不覆盖。

## 原窗口实际基线

Root 唯一首执行 `bc96a2` 实际退出 0：两个测试声明、47 条 expect，分别在每族执行恢复输入、部分付款、事实晚错三个 fixture，共六次真实窗口调用，不能说六个不同测试。

原 request 没有本族交付 guard／completion。原 stage、原 context、领域 current 临时变坏时查询交付仍通过，恢复后真实选择完成；deadline 派生对象及 alias 自己更换 context 也没有获得本族绑定。`deferRequestDelivery` 返回 false，真实 Trace 在领域付款之前已结算。Victory 安装与 chosen fact 的同一 Error 均保留已写库存／选择，前者不安装成员，后者已完整安装。脚本、原 stdout、结果和 Root 命令／退出来源按原字节保存在本 prefix 的 baseline 四附件。此基线没有测过期、Guard、完整归档终结或其他四族，不重复运行。三主源为当时实际 Git，传递模块按执行时工作树读取，不冒整个进程是隔离 Git 构建。

## 唯一元数据 owner

`RequestLease.window<Scope>` 只接受不透明 scope 的 actor／phase／day／stage 和晚领域查询，不接受完整 request matcher，不导入 World／Role 或创建第二权限表。每原请求单独一个 scope、独立记录／completion；原实例 WeakMap 持有所有 metadata 和 alias 集合。

动态查询按 actor、phase、原 context 身份、day、stage、声明 context pins 顺序，再晚核领域 current。声明键列表复制到本实例；声明字段保存 bind 时原值／引用，按 Object.is 比较。只 pin 顶层请求和明确字段，不给合法 getter、Proxy、undefined、cycle 新增 deep schema、JSON 或 freeze 政策。字段仍可执行和抛错；条件成功后先登记关闭记录，再捕获字段／顶层 pin，捕获异常保已登记关闭前缀。

丘比特 110、混血儿 120 不声明额外 context pin；LastWords 130 明确声明 trigger、death_phase、death_action_id，由其真实 permit 查询提供领域当前性。这些标签不是死亡许可。动态 day 不固定为 1，调用方原先不同日期读取不合并。

原 envelope／领域当前性观察坏或观察到期，永久关闭共同 turn；已登记 alias 自己字段／context 坏只退自己；外来 owner／未登记对象先拒绝，不毒化原 turn。合法 alias 只有全部接纳成功才登记并收缩最早有限未来预算，观察到期后时钟回退不恢复。未登记对象缺少 delivery guard 不代表授权，仍不能冒本族 scope 或领域提交。

## 真实付款与错误边界

两窗口在 create 后 bind／open，准备 Provider callee／参数后、await 后、validator 后及首语义写前查询同一个 turn。原 current 与 canAct 正文保留，新增查询只影响未付动作；不改变纯知识、目标或已付关系效果当前性。

丘比特按原 bindLovers、choice 两写、所有成员 Victory 安装完成后才 complete；混血儿按 choice 两写、Victory 安装、committed 日次写入完成后才 complete。true 先落终态再通知，随后原 chosen／recognized／resolved 事实才发表。部分付款错误 false-close，保已写关系／库存／选择，不回滚或重新使用请求；事实或 true 通知晚抛仍保持一次 true。

每个 attempt 独立 finally false-close，重试用新的原请求。旧正文错误（包括 throw undefined）优先，新 false 通知不能盖它；无正文错误时新通知异常正常传播。没有事务、通用 cleanup 框架或对任意 CJS／全局反射替换的等价承诺。新增 scope／闭包分配、guard／clock 读取和 catch／finally 栈都是本次真实 API／行为变化。

## 样本与验证边界

首 ready `be92e091…` 完整保留。首次检查前发现单元 death_action_id 字符串与公共 number 类型不符，仅把同一 fixture 改为合法编号；Root 同时要求追加第 14 个真实 Trace 用例。它让两族部分成员安装失败，真实 Trace deferred false 将 returned action 覆盖为 error，再通过初态／失败 checkpoint 和 build 消费当前 parser。预期来自手写库存／引用／error／settleOrder，不由 verifier 算法生成。原 13 个声明除该编号输入外不改；没有被抹去的运行红，后继 ready 为 `4a8b66d2…`，生产三源原 SHA 不变。

Root 首单元 3d2253 实际退出 1：原 13 个声明通过，第 14 个声明在 generic schema 前拒绝，原 stdout 的 158 是该失败轮全部 expect 调用，不能分配为“13 绿的成功断言”。根因是局部测试 builder 把构造选项 requiresAction 放入 strict context；尚未进入新 verifier。保留该轮完整 unit 730a82ad、实际 ready 4a8b66d2、原 stdout 和源码。

Root 批准只在第 14 声明按真实 NightPipeline 拆出 stage／requiresAction，其他机制 context 仍交原工厂；原 13 声明、helper、断言、生产三源和严格 schema 不改。输入实际 JS 有意不同。Root 0e7ef1 仅该失败标题实际退出 0：1 pass、13 filtered、24 expect，两族都实际走到失败 checkpoint 和 Trace build。它与首轮合起来覆盖 14 个不同声明，不叫全 14 同一末源码重新跑两次，也不把 158＋24 合成 distinct 成功断言数。

首职责头 7f9a20 为四源／727 文档／零诊断；首正文证明 67284f 为三个完整旧程序、17 精确编辑／六份逆还原输出、61 个完整保留节点，6290 typed／772 NodeArray／7252 非注释叶为比较项两侧累计，均实际退出 0。失败 fixture 唯一小桥 47e30b 实际退出 0：完整 unit 单 delta 正逆、前十个语法 test 调用即原 13 运行声明、全部 69 个 expect 调用点保持；两份逆输出相同，实际新旧输出不同。其 4684 typed 为两侧累计，叶访问计数包含递归重复，不当 distinct token 数。主证明、头及原 13 业务均未重跑。

source-ready-repair 内继承的 newPolicyChecksExecuted:false，以及 successor.limits 的“首检查尚未运行”，只描述首静态准备阶段，不是说 repair 捕获时还没执行首检查。原 ready 不改写消除历史；各实际执行先后以 receipts 和共同 first／repair fence 为准。\n\nRoot 共同十根首类型 2ced09／88699→dc5601 实际退出 2，23 诊断仅在两份新 verifier，本批四根无诊断。只三份 failed／changed 根后继 04b7aa／75119→aecef4 退出 0（空 stdout），包括本批改过实际输入的单元。共同 first／repair fence、两配置／raw 和收据七附件按原 SHA 引用，不称末十根全重绿或全仓 check。完整实际阶段在 receipts 中绑定。

正文证明限于三个旧完整程序的精确 forward／inverse、原四协议与 metadata／finish 正文、两族纯 current／canAct、请求／Provider 表达式及原付款／事实完整节点。新旧实际 JS 有意不同；逆向还原输出相同不是新 F02 行为等价、完整冷加载或全机制验收。typed／NodeArray／叶计数是比较项两侧累计，不当 distinct 仓库源码量。源码与 baseline 证据均不替代最终同源严格 Tape、独立 verifier、全仓 strict／业务／本机通信与前端验收。
