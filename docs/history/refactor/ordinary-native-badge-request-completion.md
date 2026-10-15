# 普通预言家与死亡警徽的领域事务交付

本批是 plan §7 的显式行为政策：Provider 返回候选，全部指定领域写入成功后才通知完成。Trace、schema 2、公共 replay 与未接线请求的默认结算均不修改。

## 范围与真实来源

基线为实际 `1d42f118f80f3ffadcd35f367d8569ed20928bd7`。完整三原稿、Git blob／mode／SHA、两个新增路径的真实缺席、六份控制全文保存在本前缀 `before.json`。原 TMP 输入与这三份已提交原稿全文相同后才应用；不把之前 core→domain 工作区或同时开发的 Q3 声称为隔离 clean Git。

五源按冻结顺序为：新普通 native 请求 lease、Seer 夜阶段、Badge 选择窗口、Badge committer、新独立单元。只有一个共享的既有 RequestLease 实例保存普通夜请求绑定；Badge 自己复用同一 owner 的独立实例，World 仍唯一拥有死亡 permit。没有另建按角色分派的 WeakMap，没有修改 PM、DR、NightPipeline、工厂、Trace、schema、角色槽或核心 lease 算法。

新普通夜入口先核请求 `ability_id` 与原 makeRequest 参数位置捕获的同一次能力编号读数，再登记 order 140；这是明确新增的 F02 约束，不增加 World 查询。Badge order 150 只 pin `trigger`、`death_action_id`、`badge_candidates`、`allow_fallback` 的原值／引用，不深冻结或以名单当许可。原信封／领域当前性／观察到期属于共同终态；坏 registered alias 只退自身，最早期限观察到期后不因时钟回拨复活。

## 领域写入与完成点

Seer 保原目标、生命、映射、反射和错误分支。同步提交仍按原反射回执入口、Seer 状态、咒狐提案、checks、use、modifier、native reflection、自身行动历史顺序执行。最后一项成功后立即 `complete()`，随后才发表 `seer_checked`。前面任何部分失败都 false 并保留已发生的物理前缀；false 不表示从未写过。提交前缀开始后不新增 `isEligible` 查询，尤其 use 改变当夜资格之后不能撤销已付结果。Demon sealed controller 原分支不进入这个普通窗口。

`commitSheriffBadgeChoice` 保原六参数，追加第七参数 `onDomainCommitted` 与第八参数 `beforeDomainCommit`。后者仅由新窗口传入，在原 World／徽权重／政策／目标资格全部预检后、首 `isSheriff` 写之前核交付；非 true 返回 null。默认旧 caller 不新增领域查询。首写之后不再核 current，销旧徽／旧票重、接任徽／票重以及特殊 frame 完整成功后才调用完成口，随后原 destroyed／transferred 事实和返回。原 null／无效选择仍合法销毁，不改成跳过或回退接任；无请求的早期无候选路径保持原调用。

Provider 和同步提交入口保原 receiver／callee／参数先求值，新增 `Reflect.apply`／bind 准备也放最后交付守卫前，之后只调用已准备函数。新增全局查找、bind 分配、调用栈、模块依赖、回调尾参、函数 length 与查询次数均为明示 API 观察，不宣称任意 getter／Proxy／setter 事务隔离。核心 RequestLease 和领域许可仍各自承担原职责，不凭 DTO 重建权限。

## 错误与清理

Seer 的新增 false 通知不覆盖原正文错误。Badge 原 permit.close 仍先执行并覆盖正文错误；新 false 通知只有在没有旧错时才向外传播。独立 boolean 保留 `throw undefined`，不能用“错误值存在”判断。complete 先终结再通知：true 通知或晚事实 sink 抛错不退款、不二次 false；原正文和原关闭错误的优先级不变。

## 静态发现与真实执行阶段

首八声明／140 文本增量只处于准备阶段。同行发现 Badge 内部 getter 可能在外层守卫后关闭原请求；Root 批准最窄内部首写尾和第九声明，旧完整 ready／源／工具输入保在 `internal-guard-first-snapshot.json`，这是静态发现，不伪记为运行红。此前两条新文件头只补准确职责／输出，首样保在 `precheck-head-precision.json`。

Root 首 unit `e19b8b` 真实退出 1：0 pass／9 fail，全部被不存在的 `game-contract/identity` 公共子路径阻断，没有进入测试正文。首联合类型也真实失败，仅本 helper import 与新 fixture 的 readonly 配置类型两根。首五头 `c578db` 和主证明 `82f2c8` 均真实 0，保原输入和输出不重跑。

只修 Phase 到实际公开 package 根，仍为同一 `identity.ts` enum；新 unit 只加擦除的 `BoardConfig` specifier／断言，实际 `structuredClone(game.boardConfig)` 不变。两源窄桥另存：helper 模块路由输出有意改变，unit 的两份实际 ES／CJS 输出相同。随后原九项唯一首次进入正文 `1ed281`：6 pass／3 fail／457 expect。失败只在新测试把原生 `lastUsedDay:null` 误写成 undefined；actual 基线完整 `abilities.ts` 合同另存，未改生产默认值。

仅两条断言修为 `toBeNull`，原 unit／raw／ready 保在 `last-used-day-first-snapshot.json`。只补跑三个失败 Seer 声明；其余六绿、类型、头、主证明和前桥均不重跑。该修复是字面 oracle 变化，不能称纯 type 或运行等价；单 unit 完整正逆／两输出窄桥明确当前 matcher 输出不同。

最终失败三例 `5b9c6a` 真实 0：3 pass／6 filtered／155 expect；两断言桥 `86bc00` 和前路由／type 桥 `c6c3bc` 均真实 0。onlyfailed2 类型 `f55d82/session44253→5ad92b` 真实 0，最后两 matcher 按 Root 明确授权不重类型。九个不同声明分阶段通过，457＋155 是实际累计 612 次 expect 调用，不冒独立覆盖数或最后完整九项重跑。首联合八根真实红与后继两失败根绿不能称最终全八根绿。最终真实 cell／terminal 与共同类型路径以 `receipts.json` 为准。原六 characterization 的 `450f8d` 两声明／六 fresh／37 expect 原 script／21原稿before／ready／plan／results／raw 已按原 SHA 复制至本前缀 baseline-*，脚本使用 `.ts.txt` 避免被发现执行，映射见 `baseline-copies.json`；未重跑，其候选 outcome 并非本新政策验收。

## 证明与实际边界

主证明在首执行输入核三份 whole 程序、141 个精确文本编辑正逆、完整 AST／NodeArray／非注释叶、六份 whole 逆 ES／CJS 输出；另核 48 份完整保留程序、22 个原 Seer if、36 个原 import、四条真实相对绑定与两个完成位置。原 Badge committer 只移除两处完成调用及新增首写守卫后，完整原体相同。原参数与其它 Badge 方法保持；新行为不据此宣称新旧全等。

两个后继窄桥分别承接公共模块路由／擦除 type，以及两条新断言。旧主报告和首头仍绑定其实际采样阶段，不能冒最终全五源重采样。九个真实声明覆盖普通 Seer 与死亡 Badge 的具体交付／失败／完成边界，不代表 Guard、受赠查验、Order 或所有 55 角色窗口已经事务化，也不证明特殊 frame 的所有运行分支。不得据知识、目标、字段结构、pure current 或归档数据授予新行动权限。

最终 SourceReady 的 checksRun／currentInputChecksRun=false 属于该输入捕获时点，后继 Root 的真实执行由 receipts 记账，不把历史静态 limits 解释成整个功能至今未检查。三个共同1966文件 fence 仅各自历史工作区样本（含 Q2／Q3 WIP），后继源差分单独保存，不冒当前全树字节恒同。所有首脚本／raw／report／来源历史不覆写，未执行旧实验、模型、全门禁或类型／头／proof绿重复；author 没有 stage／Git／progress 操作。

## 批准后单句说明精度

首正式 scope b9c0／MD dc1027／evidence5fd351及 author／handoff／ready 全文、helper 完整前态保于 `comment-precision-before.json`，首非作者批准5d94原字节另保 `independent-first-approved-snapshot.json`。Root 采纳仅一句 JSDoc 明确“编号初次关联不另查 World／Camp；开窗当前性仍委托原 scope，不建第二许可”，避免将标量关联不额外查询误读为整个开窗不读 World。Root636283真实0：一注释完整正逆、完整非注释树／NodeArray／叶／程序化 tag 相同、两份实际 whole ES／CJS 输出相同，另四源字节相同。所有九业务、类型、职责头、主proof及原桥不重跑；该末桥只承接描述与最终 SHA，不扩大任何新政策。
