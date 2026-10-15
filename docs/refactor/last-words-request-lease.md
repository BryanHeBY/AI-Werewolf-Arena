# 遗言窗口的请求租约与发表完成

## 范围与来源

本批明确增加交付政策，只改完整 `last_words/window.ts` 与新增专属单元 `last-words-request-lease.test.ts`。实际开工 Git 为 `6714bef448e48dec7d1871d6deb10a0d3d86f06b`，原窗口全文与此前机械迁移的 `f5e84b54` 字节相同；旧专属两绿不改、不重跑。World、遗言机制、工厂、网关、交付元数据与 DR 六个控制在该 Git 保存全文／blob／mode／摘要。

共享 `core/domain/request-lease.ts` 属于另一作者，本批链接其动态 `window<Scope>` 实际输入阶段 `8990b10d`，不是宣称它等于本批 Git 的不变控制。未来共同有限类型采样按 Root 联合 fence 记录，不把当前所有传递依赖称为固定旧树。

Root 唯一旧行为基线 `814bf1`：`/tmp/awa-last-words-lease-policy/baseline.test.ts` 首次退出 0，一项声明、两组独立输入、24 断言。真实 bootstrap World／工厂／网关／死亡许可下，旧原请求的坏 actor／phase／day／stage／过期预算仍不阻止按捕获死者发表；原与别名的 `deferRequestDelivery` 都为 false。另输入保留 sink 已追加再抛的事件前缀，并由原 `permit.close` 错误覆盖。该基线只刻画旧行为，不作为新政策 oracle，也未复跑原两例。原脚本、前态及 raw 在 `/tmp` 原字节保存；测试 setup 抑制了 `console.log`，原 raw 只有 Bun 终态，不能声称字面 JSON 轨迹曾进入日志。

## 实际责任与新交付政策

- 仍在 collection 入口按原 callee→World／events／第一次 day 构造必填工厂，构造后另读 collection day。不合并两次读取；新字段协议明确要求请求日次与 collection day 相同，所以恶意／可变 getter 产生不同两日时新增拒绝，不冒机械等价。
- 原来源阶段、遗言政策、循环前域条件及 `openDeathAction` 原位置保留。World 唯一持有原生命／版本与死亡行动许可，窗口没有第二许可表。请求中的 `death_action_id` 不是凭据。
- 每个真实 request 新建独立不透明 scope，经现有 `RequestLease.window`（传播顺序 130）bind 后 openDelivery。动态 actor／phase／day／stage、原 context 引用及 `trigger`、`death_phase`、`death_action_id` 三字段 pin 在共享 owner 核验；三字段按 bind 时的值／引用作 `Object.is` 比较，不增加深 schema、冻结或 JSON 检查。
- 原请求／共同域失配被观察后永久关 turn；已登记 alias 自身 context／字段坏只退该 alias，不能毒化仍合法的 original。合法别名共享只能缩短的最早绝对期限，观察到期之后即使时钟回退也不恢复。不新增后台 timer、World／Role 反查或通用窗口框架。
- `scope.current` 保 `scopeCurrent`→phase→day→gameOver→原 `World.hasDeathAction` 的短路顺序。原 create 后只有 scope／permit 查询，现在提前加入完整状态查询，明确属于 F02 新政策和新增 getter／错误渠道。租约失配与原域失效一样 return 整个 collection；null／非 speak、网关结构化拒绝仍沿原 continue。
- provider callee 与原 receiver／请求引用先准备，再读取新增 `Reflect.apply.bind(Reflect)`；末 guard 后只调用已经准备的函数。网关仍在原工具分支和原完整参数表达式处执行；等待后及网关后先复验，再准备发表。
- 发表保 events→push callee→时间戳→日次→清洗文字的读取顺序。完整事件、参数数组与新增 Reflect／bind 观察均在最后 guard 前准备，之后只调用准备好的函数。两个新 Reflect 查找、bind 分配、模块加载和委托调用栈都是可观察 API 差异，不能称任意全局重绑定／CJS 反射／可执行 getter 下全等或事务。
- 只有实际 push 正常返回才 `complete(true)`，先终态再同步通知。provider 返回和 gateway.ok 都不是完成。sink 可能先写再抛，这时 false 不回滚事件；true 回调晚错也不撤销已写事件或发送二次 false。只保证这些明确边界，不承诺任意 Proxy set trap 或外来函数中的事务隔离。
- finally 先原 `permit.close()`，其错误仍盖正文错误。新增 false 通知始终尝试，但有旧正文／关闭错误时不能覆盖它；没有旧错时新增通知错误按原值传播。独立 `failed` boolean 保留 `throw undefined` 等任意原抛值，未用错误值充当哨兵。

## 必要风险与证据计划

新增四个手写声明，真实工厂／World permit／网关参与：第二日发表后 true 与 registered alias 单独坏、null 仍逐人 false；原 context／三来源字段与 stage 的观察失配后恢复仍终态；实际挂起 provider 的最早 alias 期限与时钟回退；新 Reflect getter 晚失效不发表、sink 前缀及 close／body／false 优先、throw undefined、true 通知晚错。

`source-ready.json` 是首次检查前两源摘要与共享 core 输入阶段，不因后续运行覆写。`checks-prepared.json` 只列 Root 首执行命令，作者不运行产品、编译、头或证明。备用两根类型配置不会与 Root 共同十根 finite types 重复。Root 首次新单元 `c7fc4c` 实际退出 0：四个不同声明、91 断言；职责头 `7eb682` 实际退出 0：两源、727 当时 Git 文档、零诊断；完整证明 `85b7bc` 首次退出 0。未重复任何已绿输入。

纯程序证明准备为一份完整旧窗口的 51 精确文字编辑正逆、原与实际完整 AST／NodeArray／非注释叶、13 组保留完整程序／参数和实际动态 binding／当前性短路／准备后的调用序列。两整 ESNext／CommonJS **inverse** 输出回到原稿；有意政策的 actual JS 不同，不把逆证明冒称行为等价。没有模型、全门禁、源码身份豁免或全角色完成声明。


## 实际有限类型阶段

共同 `relationship-last-words-joint-source-fence.json` 捕获十根，含本批两源原 `fc19` 和共享 core `8990`。Root 首次类型 `2ced09`／session 88699 → `dc5601` 实际退出 2，23 条诊断全部在另一批新 Cupid／Hybrid verifier；本批两根和共享 core 无诊断。后继由各作者修真实失败或实际变更输入，Root 按最终共同收据有限复查；本包两根及十根首样本不重复。共同末收据 `relationship-last-words-joint-type-receipts.json`（`05646964`）已冻结：只两个失败 verifier 加另批实际变更的 Trace 新单元，共三根由 Root `04b7aa`／session 75119 → `aecef4` 实际退出 0；两次 config／raw 与首／修复 fence 共七个共同附件保留。原 source-ready 路径后被 Choice 作者更新的首样本，实际 `4a8b66d2` 完整内容另由 first-executed snapshot 承接，首 fence 不覆写。本批两源仍原 `fc19`，不称末十根重新全绿。

证明实际计数分别为：原完整窗口 581 typed／65 NodeArray／699 非注释叶；新窗口 777／112／965；新单元 2,067／457／2,690。13 组保留程序／签名、51 精确全文正逆、两个 inverse 整输出及实际调用次序均首次通过。原与新窗口的真实 ESNext／CommonJS 输出摘要不同，保留此有意行为／API 差异。


正式冻结只列本批两源、六不变控制和共享 core 实际输入摘要；所有 review 不进入作者附件摘要。Root 仍唯一持进度、暂存和功能提交，作者未运行任何产品或检查。
