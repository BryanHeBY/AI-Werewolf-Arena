# 猎魔人参与者数据证据与审计 codec

本批三个实际源码：原 `demon_hunter/authority.ts`、新的同族 `participant-state-data.ts` 与一个独立风险单元。真实开工 Git 为 `4e5937fd05d426f80be17487de52e4a602936cff`；完整原文、新模块／单元缺失及六个稳定控制已捕获。源码与有限证据现已冻结；只覆盖本批完整数据职责，不作为全族或全量验收。

## 完整职责与原字段

新 owner 声明原 Participant 的私态、顶层／嵌套库存引用证据、最近同步审计串、委托键与 Victory 串，以及原 checkpoint 的 Badge／Vote 数据串。字段仍存在原参与者和 checkpoint 对象；没有新 Map、WeakMap、第二份 live 库存或后备 JSON store。

完整原递归引用枚举、逐路径原引用检查、Badge／Vote 安全数据编码、私态比较、委托缓存解码和 checkpoint 十一字段装配归该 owner。原普通数据、扩展字段、Proxy／descriptor 接受、nullable、JSON null sentinel 均保持；不增加严格 schema，也不提前执行归档 `z.json()`。

实际数据提交包括 hunt history 返回后的审计刷新、原生毒药消费缓存、Witch reset／commit、Seer／Guard 的状态与能力数据提交、Hunter 耗枪、Badge 双串批次、RedMoon 族写后的审计核对及 Idiot 翻牌／票权／引用证据提交。具体完整数据步骤迁出，不以几个通用字段 setter 代替职责。

World、角色／生命、阵容、配置、夜间、请求、目标、资源资格与冻结判断继续归 authority。委托 Noble 查询以原点回调传入；Noble 与 RedMoon 状态仍由各自已交付 owner 写。原公开 authority／ports 的 command/query symbol 和外部调用方保持；新数据函数不向玩家或录制赋予行动许可。

## 可观察顺序与失败前缀

- 私态先安全编码，无委托即比较旧审计串；有委托才调用原权限复验，然后依次解析 actual／expected、删去原委托子树并比较。解码先查 `JSON.parse` callee、再读 audit 字段，解析后才查委托快照和 actor 匹配；未委托分支不新增 Noble 查询。
- 原 descriptor 捕获仍先于嵌套引用检查。顶层引用比较留在原 Role／Camp／privateState 身份条件之后，不聚合成更早的 Boolean 或改变短路。
- Witch 的 opened 标记仍在 reset 前；模板编码之后才写三个 live reset 字段，再核整容器、更新审计串。Seer 状态／历史之后才写 uses／lastUsedDay、编码和比较；Guard 保原重复规则。Hunter 的 canShoot 消耗先于编码。晚字段或编码错误保前写和旧 audit，不退款或补写。
- authority 的原局部 committed 标记留在内容核对成功之后、audit 字段写入之前，以具体成功回调保留夹层位置。它不是新增生命周期协议；回调抛错时不前进到原后续 audit 字段。
- Idiot 仍先形成两份期望串，再写 revealed／canVote／weight；核内容后依次更新两张引用证据和双串。Badge 批次已标记 committed 后才逐参与者写 badgeJson、voteJson。失败不恢复库存、生命或票权。
- 原 `nativeArrayPush = Array.prototype.push` 仍在 authority 原模块初始化位置捕获；数据 writer 只接收该原函数，不在新模块更早捕获。整 Demon players 优先、complete 权限、metadata 检查和生命 getter 时点保持，原 checkpoint 每个 JSON 字段逐次读取。

新增具体函数出口、数据返回对象、展开、回调分配、函数栈及模块依赖边有意变化。不承诺任意 CJS namespace 重绑、内部字段强写或全局 built-in monkeypatch 的事务等价；原正常接受集合和明确可达错误前缀才是此次保持范围。新增源码参与当前构建来源指纹；严格档案政策与历史身份不改。

## 真实检查阶段与范围

所有实际验证由 Root 执行，作者没有重复运行。首次联合 fence 为 `7d05bae3`，包含四组 12 源；它是当时共同依赖输入，不是全部历史源码或后继最终树恒同声明。Demon 两生产源码从首次运行至主证明成功均未改变；此后 authority 仅删一条错贴于 validBinding 前的遗留说明，按下述单注释桥承接。

- 首次新单元 `c94840` 是 **2 pass／1 fail，raw 20 expect calls 含失败**。Guard 夹具误将 `installNativeAbility` 返回的 GuardState 当成能力元数据，`ability.state` 为 undefined，先 TypeError 遮住预期 JSON Error。首源全文、raw、原 ready 保留，不能声称该旧输入已绿或猜分成功断言数。
- 修复仅在 Guard 输入前增加已有 `findNightAbility(role, "guard", "native:guard")` 查询，取得同一实际安装的元数据／state。两个已绿 declaration 全文、所有手写 Error／轨迹／资源／引用预期保持。该修复有真实 JS 输入变化，不是 type-only。仅失败 Guard 标题 `eddbe4` 再查，实际 **1 pass／10 expect／2 filtered**，其余两绿没有重跑；共三个不同案例、四次案例执行。
- 首联合 12 根有限类型 `092650／session64038 → c3b6ea` 真 exit 2：Demon 单元四条误读诊断及另一 Noble 单元一条输入诊断，生产根无诊断。只联合两个失败 unit 根 `89b65c／session70497 → ac39a5` 真 exit 0；空日志不代替终态收据。未复 12 根，也不称全树类型绿。
- 首三头 `5c6cfd` 真 exit 0，719 个 Git 文档路径，零职责／中文头诊断，没有复跑。

首 proof `69da15` 真 exit 1。实际 Idiot 迁出完整 18 行 raw body 与原内核逐字同；工具却对 current body 先调用 TypeScript printer、对 old body 使用原文本，导致两处 call NodeArray 的 trailingComma 从 true 变 false。保留原执行脚本／raw；只改工具用真实节点 `getText`，并从真实 before 截取顶层引用原表达式，不降低 kind／leaf／NodeArray／trailingComma 比较，也不改数据算法迎合工具。

仅失败 proof `728541` 真 exit 0：原 authority 完整精确 forward／inverse、11,833 个 forEachChild typed 节点／1,455 个 NodeArray／6,264 个叶（排除 JSDoc），两份完整逆向 ESNext／CJS 输出同。当前直接 authority 输出不同是新调用边界的实际结果，不冒 raw 二进制等同。

证明另外读取 **20 个当前完整实际数据内核**，按明确 callee／成功回调映射直接对原完整程序，不用旧 authority body 替换新 owner。完整内核运行输出按共同 printer 规范布局后比较；未经 printer 的原布局 raw 是否相同逐项另列，不一概冒原 raw 输出同。Guard 输入修复则整单元精确两改动正逆、两个逆向完整输出同，当前两个输出有意不同；另两已绿 declaration 全文保持。六个稳定控制的原文／当前字节与原 nativeArrayPush 捕获位置亦保留。

三个风险是独立字面预期：Guard 写后编码同错和旧 audit、parse callee→audit getter→委托与原引用／缓存差别、Idiot 晚 weight 字段错及原前缀。只调用真实数据函数和角色／库存工厂，不镜像 World 权限。**本次未执行旧 authority 案例**；先前建议的 native-potion audit 精准场景只是 coverage 备选，不计本批绿。未运行完整对局、类型全树、全门禁或模型。

正式 [scope](generated/demon-participant-state-data-owner-scope-final.json)、[receipts](generated/demon-participant-state-data-owner-receipts.json)、[proof](generated/demon-participant-state-data-owner-proof.json) 与 [evidence](generated/demon-participant-state-data-owner-evidence.json) 绑定每个实际阶段。静态来源 audit／inventory 保留其只读时点和候选限制，不变成已执行的整盘反例或权限凭据。

## 末维护注释精度

Root 全文审查后只删除 authority 中遗留的“两个原生子树…”说明：原 privateAuditCurrent 已完整归新 owner，该说明却紧贴 validBinding。新 owner 真比较函数的中文头已经准确，不增加第二条说明。

原 scope／MD／evidence／author-review／handoff 全文与摘要存 `first-approved-metadata-snapshot.json`，原独立批准由 peer 另存 snapshot；原 source、主 proof、首头、有限类型和业务采样均不覆盖。Root 唯一窄桥 `215536` 真 exit 0，完整单 comment 正逆、typed kind／leaf／NodeArray／受保护 tags、两整 ESNext／CJS raw 输出同，另外两源仍同。没有复跑旧绿或把首次主证明的 authority SHA 冒成末头采样。

## 边界

这是 Fr／DH 数据槽之后剩余参与者数据层；不重新迁移已交付 history 槽或安全 JSON helper，不代表 C17／C37 全部角色、schema、codec、原体失效或 P 验收完成。Noble state/profile、PM 黎明、DR 遗言属于并行批次，不能把其工作树闭包当作本批不可变控制。
