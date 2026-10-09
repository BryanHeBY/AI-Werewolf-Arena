# P7：被动赠枪库存、夜末激活与逐枪结算

本笔落实[规则卡](../rules/awa-black-market-merchant-v1.md#black_market_merchant)与[底座步骤](../black-market-merchant.md#1-被动赠枪底座)。前一笔许可绑定 `0c3c878` 保留。本笔提供受控G02接口和完整死亡流程，**没有注册Black或开放其交易/板子**；当前22 verified/42 planned。

## 状态与提交所有权

- DeathGun独立库存，不属于NightAbility，不覆盖原Hunter/Aw等原生资源。实例ID按World计数、不编码donor；World/role/private/life/version等捕获引用与比较快照留在运行作用域，不进入JSON；合法库存、语义source和实际激活时点可以记录，donor号码不进入玩家投影。
- grant/transfer只给合法存活Good，保留实际领取/激活/库存/disabled/过期事实；旧实例退休、copy拒绝。已赠库存不因donor后来死亡回收。重apply、换body/owner及复活不能获得原库存授权。
- 900实际夜末才arm，未到900的中断不猜激活时间；Profile可能产生死亡能力时，即使夜初没有库存也收集900处理器。实际提交后的同World/night重入拒绝。
- 原生Hook结果经DeathResolution真正标死目标并发布事实，关闭那次permit，再开gift实例的独立许可和当前活人目标。原枪null仍进入另一库存；先清末Wolf或末神也先完成剩余枪/死亡链，再由PhaseManager judge。
- 待发枪不会被首次死亡提前禁用。DeathResolution完整流程的finally令原已死body的库存永久过期，错误/取消也保已提交死亡前缀；新owner不会被旧回答消费。
- pendingShot实际提交再核原receiver World/body/metadata与目标life；此时不按remaining=0撤合法已付效果。三次非法gift选择明确失败，无假枪/回退。玩家枪保持中立player_shot/death_shot，God原生Hunter来源保留，WolfKing等旧具名规则不扩大中立化。
- 本人DTO新增必填deathAbilities；外层/state/source、事件按已知字段投影，source仅kind，状态与已绑定实例说明经同一玩家prompt策略供SDK/ACP。角色/阵营/名字/胜利归属不变。新事件actor-only，终端私有模式、裁判、前端/视频共用中英safe label。

## 独立首审、修正与复查

- **R/T与A**：原owner漏World字段，另一World重挂相同Role/Alive/gun refs会借权；增加World匹配与仓库负例。原gift hook未检查targetScope.id等于selected.targetId，错误生命快照会击杀另一个号码；增加ID终验和直接hook负例。两项独立/tmp probe先红后绿，目标拒绝不耗枪。
- **A**：核逐Hook真正commit再close、fresh permit、pending过期、paid owner终验与独立资源，无新增框架或职责转移；独立核心37/247首审0。后补Profile贡献案例以根最终39/254为准。
- **R/T**：独立核心38/251及原两项probe2/5通过，四条完整PM临界场景按字面预期核原生先1/3、gift再3/1、仅V4/5/6活，Good胜且赢家2–6；不以低层受控grant冒Black交易。
- **L/D**：原新事件只加live入口，judge为null而front有标签；补共享judge入口。armed操作却armedOnNight=null错误显示已激活；补状态一致性校验，两语bad descriptor/gun库存/恶意getter回退unknown且零执行。独立投影/提示/标签probe4/88通过，未知字段/donor裁剪、转移不改身份。
- **最后自检**：过期事件原先展开完整gun对象，未知私有getter会被求值；改为只构造捕获id/领取激活日次与固定过期状态，emit形参声明所需Pick，新增真实死亡/null枪/getter零求值反例。源码指纹改变后重新跑受影响1188、18旧局/Tape与静态，全通过。
- **根测试修正**：新实际模型fixture错误期待“Active/可用”，当前共享字典为“Effective/已生效”；三拒绝的私人记录是turn_invalid_action_limit，不是outcome的no_valid_action字符串。仅纠正测试。受控God档显式从bootstrap设Seat名字，manifest与开局同源；补真实起止时间，最终fixture与PNG保持一致。

## 最终证据与范围

生产源码在最终实际旧局/Tape之前冻结，以下日志均核exec终态exit0：

| 门槛 | 证据 |
| --- | --- |
| 核心 | `/tmp/awa-gift-gun-core.log` **39/254**；含两库存、禁死因/compound、paid到commit撤权、donor死保资源、原World、原目标、错误/取消、晚激活/重入、夜中产生能力及四完整PM场景 |
| 真接入与记录 | `/tmp/awa-gift-gun-runtime.log` **16/238**；double/native null/V recipient/strict3 invalid ×zh-CN/en×SDK HTTP/真实ACP进程与注入MCP。核绑定prompt、原角色、null失败/无fallback/无假死亡、永久过期、permit0、runtime close及ACP/MCP PID ESRCH |
| 旧实际完整局/Tape | `/tmp/awa-gift-gun-old-game-tape.log` **9/3955**，猎人首夜/枪链/原十二Aw×SDK/ACP/混合×两语＝**18完整局，每局strict Tape**。这是旧角色兼容门槛，不称新赠枪严格Tape |
| 受影响后端 | `/tmp/awa-gift-gun-final-affected.log` **1188/13101/87 files**；全部engine、AI agents及所涉actual集成/recording/replay/presentation。不是全backend release |
| 静态 | backend type/deps/boundaries/i18n全部exit0（仍57精确例外），git diff --check；frontend type/build exit0 |
| 前端 | `/tmp/awa-gift-gun-front-unit.log` **163/1429/26 files**，两个实际受控God档、双语选择不改身份/生命、两枪先后、死Good赢家、无提前judge、malformed回退 |
| Chromium | `/tmp/awa-gift-gun-browser.log` **4实际中英用例通过（2.3min）**，字幕/席位无遮挡、arming全活、gift三死且尚无winner、最后五个Good赢家 |
| PNG | `/tmp/awa-gift-gun-armed-en-final.png` frame640，全六活/0winner；`/tmp/awa-gift-gun-second-zh-final.png` frame1180，1/2/3死/0winner、2枪杀1；两render exit0，root/L独立目检无遮挡 |

新gift通路是受控死亡流程及真实private记录，四PM局是正常bootstrap/阶段推进加受控初始G02资源。**新gift的交易生产与完整严格Tape将在Black启用笔验证**，不能用本笔18旧局替代。没有新公开板子，未跑未声明板子的随机局；Black功能笔仍需每公开板20seed、字面全局/每局Tape和最终审查。

三路原审查者最后直接核fresh日志与正式文档，A、R/T、L/D均0残留，支持功能提交；getter修正闭环，数字与历史独立探测分开登记，未重测无关内容。P7 Black随后完整启用，再全已支持P7验收，P8–P10/64角色22机制/长局/T6持续。未读写用户configs/认证，未调用外部模型。
