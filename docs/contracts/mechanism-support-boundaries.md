# 机制验收与支持边界

本文与当前机制矩阵配套，只限定本轮重构交付的支持声明，不新增运行协议、schema 或兼容层。已提交导航锚为 `60fdbfbc57122eeb1d4e9204b66d4daec1eb0157`；该实际source/08cb的42项真实终态与媒体已由[最终验收](../history/acceptance/refactor-final-acceptance.md)（E220）发布；43次attempt保留PW首次环境失败和只缩短TMPDIR的补充。843适用格有界验收，67本层N/A只复核理由。历史证据、当前源码身份和后续文档发布提交分别保存。

## 适用性与验收声明

- `not-applicable-local` 仅表示该行没有本层自有职责，必须有具体业务理由。原路径保在 `contextOwnerRefs`，不能据此把容器、类型或 registry 说成请求 owner。`delegatedRowRefs`/`delegatedOwnerRefs` 指向实际承接者；不是整行或整个角色免验。
- 纯 Role 容器、clone、契约、显示、registry 没有自己的 opaque 请求或领域库存付款。它们的数据/可见性/登记/错误次序仍按真实 consumer 验收。普通函数输入可触发 getter/callback，不因此把该层定义为统一动作事务。
- 无库存不等于无提交：遗言以事实 push 返回为提交；Wall 合法 optional null/validator 拒绝可为已完成处理；选票收集不等最终放逐或死亡付款。已有机制各守自己的完成点。
- 平民没有本族原生私态或技能；Bear/Gravekeeper没有本族主动反馈选择。公共发言/投票、获赠能力/赠枪仍适用。EvilKnight/RedMoon继承普通狼runtime，不能因特殊被动技能无额外请求而把狼聊/刀也标 N/A。
- 本次登记的是 **bounded refactor accepted**：声明owner、真实接线、已批准行为差异及有限支持层得到相应证据，且受测candidate通过规定门禁。不是“910格所有规则、任意失效注入、任意板子/回调都已证明”。C47通过只提供同源环境/类型/集成证据，不能替每格补造语义覆盖。

## 独立核验覆盖

共同parser、机制独立账本和exact replay是不同层：

| 层           | 当前实际owner                                         | 支持声明                                                                          | 不支持的推论                                                     |
| ------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 格式/身份    | `recording/reproduction/format.ts`及checkpoint format | 只接受实现中声明的结构/版本/引用关系；记录身份不是权限或签名                      | parser通过不证明World真相或所有技能已付款                        |
| 独立机制账本 | `recording/verification/assembly.ts`及下表            | 不运行World/生产owner，按各validator显式规则核decision/fact/ops/CP的合法关系/前缀 | 19个调用不等55角色逐条规则全覆盖；不能从CP伪造生命ref或实际await |
| 精确执行     | `app/simulation/replay-reproduction.ts`               | 在受支持build/RNG/ruleset/输入身份下驱动真实执行并比较记录                        | 不承诺跨sourceHash运行；不承诺重现外部任意getter/安装故障注入    |

当前assembly保持下列19个有序调用。RedMoon在Demon validator内调用，不能误算成缺第20项或给它新增另一条注册。

| 序  | 实际函数                        | 物理owner                                                           |
| --- | ------------------------------- | ------------------------------------------------------------------- |
| 1   | `validateInitialIdentityRecord` | `backend/src/recording/verification/initial-identity/validate.ts`   |
| 2   | `validateWildChildRecord`       | `backend/src/recording/verification/wild-child/validate.ts`         |
| 3   | `validateLonelyGirlRecord`      | `backend/src/recording/verification/lonely-girl/validate.ts`        |
| 4   | `validateGhostBrideRecord`      | `backend/src/recording/verification/ghost-bride/validate.ts`        |
| 5   | `validateAnimalDreamRecord`     | `backend/src/recording/verification/animal-dream/validate.ts`       |
| 6   | `validateFragrantPairRecord`    | `backend/src/recording/verification/fragrant-pair-seer/validate.ts` |
| 7   | `validateNobleSecretBodyRecord` | `backend/src/recording/verification/noble-secret-body/validate.ts`  |
| 8   | `validateDemonHunterRecord`     | `backend/src/recording/verification/demon-hunter/validate.ts`       |
| 9   | `validateScholarMentorRecord`   | `backend/src/recording/verification/scholar-mentor/validate.ts`     |
| 10  | `validateMistRavenRecord`       | `backend/src/recording/verification/mist-raven/validate.ts`         |
| 11  | `validateRadiantEclipseRecord`  | `backend/src/recording/verification/radiant-eclipse/validate.ts`    |
| 12  | `validateTimeConsortRecord`     | `backend/src/recording/verification/time-wolf-consort/validate.ts`  |
| 13  | `validateWolfSorcererRecord`    | `backend/src/recording/verification/wolf-sorcerer/validate.ts`      |
| 14  | `validateTricksterRecord`       | `backend/src/recording/verification/trickster/validate.ts`          |
| 15  | `validateMagicianRecord`        | `backend/src/recording/verification/magician/validate.ts`           |
| 16  | `validateOrderPrinceRecord`     | `backend/src/recording/verification/order-prince/validate.ts`       |
| 17  | `validateCupidRecord`           | `backend/src/recording/verification/cupid/validate.ts`              |
| 18  | `validateHybridRecord`          | `backend/src/recording/verification/hybrid/validate.ts`             |
| 19  | `validateDeathHistoryRecord`    | `backend/src/recording/verification/death-history/validate.ts`      |

没有专属validator的族，按实际共享格式/身份/执行及其具体场景声明支持范围；这既不是“必须再造一个validator”的缺陷，也不是整格N/A。矩阵 `actualLocalRoutes` 给槽的实际profile/stage import和assembly→validator调用；旧 `consumerRefs` 的先六公共Role/Camp路径只是导航样例，不能作为本族槽/validator已接线的证明。

有限手写案例覆盖它们明确命名的分支。例如 `tests/unit/recording/relationship-reproduction-ledgers.test.ts` 与 Cupid/Hybrid 独立validator支持已批准的末decision/opaque partial CP政策；不能外推成所有资源、生命或任意error轨迹都被独立验证。当前validator/format本身的拒绝集合不因本文而扩大。

## 候选、领域前缀与精确重放

| 实际路径                     | Tape里可说的事实                                                                                                      | 领域证据与限制                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 未登记completion             | Provider返回了action/null候选；不是accepted/paid                                                                      | 后续真实stage/commit仍需核CP、facts、ops和原体/库存；无helper不自动构成漏事务                                               |
| 历史严格Tape2的deferred协议  | true/false由真实窗口完成点给出；false将outcome记error且不保存返回候选                                                 | 历史2保持严格原shape，不回填候选；partial保实际CP前缀，false不是rollback                                                    |
| 当前严格Tape3的deferred协议  | 仅实际settle(false)保存此前安全复制且正常返回的returnedCandidate（ToolCall或自身显式null）；outcome仍error            | false原因可为无效输入、期限／当前性或partial；字段不证明accepted/paid或失败原因，true与真实Provider/copy/交付早抛不产生字段 |
| `RecordedActions`读error     | 当前Tape3仅有自身候选时重交原候选；旧2或缺字段仍在Provider点抛归档error                                               | 重交候选不等接受／付款，不保证重新制造任意外部安装、期限或通知失败的领域prefix                                              |
| 独立validator读error/pending | Cupid／Hybrid先读取action或error+自身候选，已知null／无效工具／冲突目标不能借CP/facts或早候选绕过；缺字段才是末opaque | 候选只约束回复事实；合法partial与库存/组件/事实写序另审。其他validator仍按各自原合同，不外推任意错误重现                    |

保留现有 Radiant raw-domain-failure 合同：Provider返回同名工具 `args:{}`，Tape仍是action；真正领域路径随后失败。把它批量改成deferred false/Provider error会提前失败，改变操作与部分写入前缀。本轮不这样改。可导航的实际声明：`tests/scenarios/reproduction/radiant-eclipse/raw-domain-failure.test.ts`、`tests/unit/features/cupid-hybrid/request-lease-completion.test.ts`；Trace在 `recording/reproduction/trace.ts`，error Provider在 `app/simulation/replay-reproduction.ts`。

支持范围因此明确：当前Tape3只在error+own-presence时重交真实候选，旧2或当前缺席仍保Provider异常语义，不推断null。八个真实Hybrid三次未付null重试是本次新增exact支持的明确消费者；独立格式、CP/facts/ops及exact执行各守原入口，不承诺任意领域partial、期限／当前性或通知失败都可无损重现。新writer3、reader严格2／3，2拒新字段；envelope1仅strict内层2／3配对，public/player2和manifest1不变。结构及独立审计先于sourceHash，旧reader没有前向承诺，跨构建门槛不降低。见[请求合同](action-requests.md)、[归档版本合同](archive-compatibility.md)及[ADR0003](../decisions/0003-request-policy-and-completion.md)。

## 55 角色的支持范围

`game-contract/src/identity.ts`的55个稳定Role与 `rulesets/roles/builtin-contributions.ts`的55个实际贡献，映射到47个profile族；共同Initial/RoleInspection构成另外2个机制行，不新增Role。逐Role的实际profile、Catalog规则卡、supportedBoardRoles/supportedWinConditions/maxCount声明在矩阵 `roleCoverage`，规则卡仍由当前 `docs/rules` 说明。

支持仅限完整板子schema、有限profile约束、配置/policy与注册的实际组合。没有 `supportedBoardRoles` 限制也仍受共同board/deck/胜利条件校验，不能推成55任意混搭。九个planned元数据ID不是runtime支持新增。一个合法six/twelve板子案例只证明该fixture，不证明所有排列、RNG种子、Worldless callback/getter输入或策略值。

测试适配必须保真实Role及坏actualCamp/source负例；不能删Role绕开资格，也不能用兼容旧constructor、全局Role→Camp镜像或伪source求绿。readonly、JSON相同、当前Camp与历史知识不等效；各族原ref/value/descriptor/Proxy规则仍独立。

## 公开 API 与来源身份

C46仅把真实跨族合同接到单target具名public面；原consumer 138诊断identity与Witch另2重复type-query坐标分别保存，不能把identity数当全引用数。实际出口symbol/原声明、保留导出顺序与初始化图沿原完整程序/绑定证明范围；新facet不是因为叫ports便自动安全。

旧PhaseRegistry/WinConditionSystem、board-presets/night-stage-registry兼容叶与旧物理deep路径明确退休。Time代码subpath由 `@ai-werewolf-arena/game-contract/facts/time-consort` 迁为 `.../facts/time-wolf-consort`；Role.TimeWolfConsort和稳定数据值 `time_wolf_consort` 保持。这是代码API差异，不是换Role ID；未知外部deep import、任意CJS反射或未登记非字面路径不承诺兼容。

物理迁移/公开面/注释/格式都可能改变sourceHash；不得回写旧Tape或历史artifact摘要求跨构建绿。old/current layout的受支持选择、package resolver、lock/RNG/ruleset沿实际reader。静态模块折回/结构emit证据不等任意冷执行等价。

格式阶段E212只证明有界结构相同：1536 output pairs中678 raw相同、858 raw不同但结构同；12文件只在证明表示中掩AwaitContext，非所有源码原AST/双raw完全相同。后继cb单测试也只是chain格式稳定修复，不能替业务全suite。

## 收口条件

四项旧问题现登记为上述**明确有限支持合同**，不再泛化成新增lease/schema/verifier/兼容框架待开发。旧cb实际运行已确认并修复三类有界合同违例：初夜来源仅有已知增量时，遗言审计不能把它当完整全集；Cupid/Hybrid本人后续请求已见选择／相认事实时，录制入口必须给Trace当前事件副本。前两笔见 [死亡来源修复](../history/acceptance/death-history-incomplete-sources.md) 和 [私有选择接线](../history/acceptance/private-choice-live-event-wiring.md)。第三类是已返回null的三次未付Hybrid重试被Tape2丢候选后重放早抛并死锁，本次Tape3按上面的版本／候选合同修正；它有意扩充严格录制格式及Cupid／Hybrid已知候选审核，不冒仅接线或原shape完全不变。三笔分别保原错误、实际输入与有界后继；第三笔完整证据见 [Tape3返回候选修复](../history/acceptance/strict-returned-candidate-v3.md)，不凭局部绿签全42。当前60fd/08cb的规定42项与媒体真实收口见E220；历史首红、局部修复与各次source身份保持。当前metadata发布由精确Git路径解析，不以旧“未确认缺口”或门禁成功承诺任意输入无潜在问题。

源码身份后继：`07ef28ef06f2579a6e7fb7467bca588c87608348`仅校准三处现行维护注释；Root实际tokens／去注释JS相同及格式稳定，不是产品测试。E219仍指向2a4b真实版本化交付及其17／18源功能fence，不改写为07ef实测，也不把注释切片造为新独立四件。

## H01／H03／H02 后继的实际边界

这些交付不增加机制行、Role或统一框架。名称唯一owner为 `packages/game-text/src/role-names.ts`，Catalog的名称字段与名称函数代码API明确退出；稳定ID、模型字段、规则卡及9规划ID身份不变。

H03由 `rulesets/action-validation-assembly.ts` 收集十类原scope/raw贡献，具体validation-rules保原读取/失败顺序；未知ToolRule只收到真实值query对象，不收到World、RoleComponent、Catalog或opaque scope。可信完整内建函数才使用私有host；这既非Readonly<World>，也不把候选、schema或任意true回调变许可。

死亡/放逐/整波hook与prepare只接query/具体command，public chooser是新标量DTO。原targetScope/mappingCurrent和原生命仍只在当次原生/赠枪资源owner内使用；没有重新捕获目标、全局World缓存或JSON授权。梦查询返回bool，而不以Readonly标签返回Alive本体。Night保34完整资源程序，公开ctx/registryquery不返回World、组件、能力实例、事件／提案容器或构造器；execute替换不能借handler同名获得私有输入。新分派、对象、Reflect与代码API观察不是任意JS/CJS/Proxy沙箱等价承诺。

角色贡献E229已实际交付：118个具名原程序静态识别，public query/stateData不返回原组件；深树副本按需读取并脱离，拒绝访问器/Proxy/循环/超限，不能把这点外推成所有owner内部不能持原体。初始化只保自己角色容器与待安装initialCamp的明确写权，胜利归属上下文分开。

**X06已交付**：下层可替换evaluator只接实际VictoryQueries，每个实际spec独占一份新方法表；不预读source方法，保早spec改表不污染后spec。默认完整算法与原World只留私有owner。

**Noble因果已交付**（E231／fa99cb42）：只对canonical Noble、单步显式版本的三个正常返回窗口应用原体换代；同一writer在录制／重放消费metadata并必须记录因果op。原十消费者exact已通过，不把候选视为生命替换或付款证明；旧Demon v1冻结点和gate不放宽。记录器晚错保换体前缀并关闭计划，不二写。普通无计划运行没有新代理，也不因此支持任意外部测试闭包。原真实缺口不能只靠bounded文字豁免，本批已有实际实现与回归。最终同输入42已由E220提供实际证据；上文Tape3的8个已支持exact消费者不倒退为unsupported，也不外推到任意partial。

名称词典的AST扫描归属由`role-name-i18n-owner`辅助包收口：只放行唯一登记名称表的直接中文值，不放宽业务字段、相邻代码或路径白名单。五头维护不改原业务契约；这些原字节会改变来源身份，新60全42真实结果见E220，f2轮仍按原INCOMPLETE保存。
