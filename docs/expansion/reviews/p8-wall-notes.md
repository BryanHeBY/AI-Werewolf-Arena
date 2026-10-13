# P8 首组有限事件与道具：匿名墙

本笔接在杠精功能提交 f8678fe070ef7632ac3f96b0c69774e52a813e90 后，于原目录main线性开发。来源为发行商New Moon规则书“The Writing’s on the Wall”独立变体（印刷10–11/PDF9–10），不是36张事件卡之一；[规则卡](../../rules/awa-wall-notes-v1.md)区分来源的匿名自由文字与AWA一次性第一日Voting后适配。唯一pack `awa_wall_notes_once_v1`、event `awa_wall_notes_v1`、item `anonymous_note`。

配置默认关闭，七基础有限白名单，独立整局一次栅栏与个人实例贯通strict schema/反向转换→真实首次非终局Voting结束→完整请求/晚Scope授权→原文字消费/过期→本人DTO/双语→God与公共事实→录制及strict Tape→终端/前端/视频frame。无新角色数量、战斗/胜利效果；不是通用交易、复制、36卡或任意道具框架。早自爆跳白天不补首日窗口，终局不发库存，平票/无人出局/Idiot免死的正常Voting仍可开始。

全部请求先构造，再逐发送前gate，等待所有已启动请求allSettled；异常选择按冻结ID顺序保留原exception，所有库存finally过期，零公共部分结果。可选min0/max1/noFallback，一作者只一个引擎请求，空回复不编造纸条；原文1..160 Unicode codepoints，getter/extra/空白/畸形UTF16拒绝，保持原空格与前缀。消费立即扣至0，后续本人撤权省略且不退款；其它合法作者继续。原生命/role/camp/privateState、实例/source/字段与window/config/phase绑定，Window与PhaseManager首行挡重入；World专属非序列化capability绑定原factory request，三个真实deadline包装显式继承原权威，跨世界/请求篡改不能借权。

匿名公共正文先形成固定UTF16词典序多重集合（保留重复），再独立wall_notes随机流shuffle；作者或回包顺序变更不改变同seed/text multiset公共结果。RNG返回后再次终验，接缝撤权取消整窗；God只在专属事实保存作者/消费/过期与rank。玩家请求只含自己instance；DTO删除内部wall_id，没有他人的草稿、数量/进度、关联或随机seed。字条自行公开身份是自由文字，不作为引擎身份/死亡事实解析。

玩家归档新写source_event_seq与event request_id改为本视角连续可见序号，以隐藏God事件行数。God序号仍规范保留，历史公共档继续可读；实际公开时间保留，不声称隐藏一般处理/网络耗时。库存expiry被冻结/只读时权限finally仍关闭，合法原实例DTO/checkpoint投影expired=true/effectiveRemaining=0；instance/source/remaining被篡改或getter污染则省略。原provider异常不被cleanup写入失败覆盖。

## 审查与逐层证据

三组只读复核闭合源码/来源/录制和呈现：原request借权、deadline clone合法权限丢失、God事实strict状态、RNG后撤权、只读finally原异常、源序号泄露和原库存投影字段等已按报告修复。最后独立56规则/307断言与记录/可见性回归通过；未以早期候选替代最终全量。

56规则测试覆盖默认off/后日/阶段0fork，getter-free Unicode，全部构造先于发送，original factory exception，allSettled首ID异常，11类life/role/state/实例撤权，paid后撤权，phase/config取消，两个世界/请求属性篡改，Window与PM入口重入，冻结/只读expiry及安全checkpoint，实际Reception与deadline，正常首日六路径、终局0请求、早自爆不catchup，旧档保持和玩家view-local provenance不泄露God行数。

6/12人×write/skip×SDK本机HTTP/ACP子进程注入MCP/混合×双语=24实际完整局及逐局strict Tape；共12测试。6人第2日、12人第4日自然Good胜，实例余额/过期与公共字面texts严格一致，任何player档无God作者/顺序事实和他人实例。无需真实商业模型或秘密配置。

5有限boards（six/twelve/Guard/Idiot/Sheriff）×20seed×双语=200受限ObservedBot自然终局、0reject/fallback，每局录制+strict Tape。独立World真值5×100×2=1000自然终局、986触发/5098发表纸条；14首日已终局不触发。两种证据分开，不以World真相机器人代替受限玩家。

四个实际SDK God档（6/12 write/skip）作为frontend fixtures，新10单元/8浏览器覆盖共享reader、原文、God非法actor和事件前后alive。真实studio/video frame按规范seq对应，旧公共档事实不改；两张中英12人write截图 `/tmp/awa-p8-wall-{zh-CN,en}-browser.png` 在字幕已显现的+15frame由主代理实际查看，角色/死亡座位/字条字幕一致。God档可显示私有作者账本，公共text事件本身无actorId。没有MP4或T6声明。

## 冻结源码最终门禁

冻结main基线 f8678fe070ef7632ac3f96b0c69774e52a813e90 加本批完整差异，sourceHash `2616e970f7f507f6d7f14b36a1f76fc0233968e9cbe2d31e04862d7179a29b46`、lockHash `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`；指纹覆盖core/game/app及共享包TS，不冒称覆盖AI/runtime/frontend全部文件，本提交保存完整差异。冻结后仅修测试工厂hooks共享污染并加隔离oracle，生产源码未改，随后完整后端四组按最终测试重新执行；静态门禁也重新完成。

最终后端 **2726通过、0失败、247401断言、222文件**；四组738/619/801/568，均exit0，最长358.96秒。清单 `/tmp/awa-p8-wall-verified-backend-manifest.json`、各组 `/tmp/awa-p8-wall-verified-backend-{1..4}.{log,status.json}`，汇总 `/tmp/awa-p8-wall-verified-summary.json`。新增56规则、12完整transport、10Observed用例均包含在完整并集；24实际通路+严格Tape、200受限局逐Tape在该最终重跑内完成。

前端 **258通过、0失败、2508断言、38文件**，`/tmp/awa-p8-wall-verified-front.log`；Chromium **112通过、0失败/跳过/flaky**，单worker、零重试，245.11秒，`/tmp/awa-p8-wall-verified-browser.json`。root check/lint/format:check、前后端build、git diff --check皆exit0；日志 `/tmp/awa-p8-wall-verified-{check,lint,format,build-backend,build-front}.log`。既有500KB构建提示保留。1000独立World基线 `/tmp/awa-p8-wall-world-baseline.json` 与 `/tmp/awa-p8-wall-verified-world.log`，报告区分200受限记录，源码指纹见 `/tmp/awa-p8-wall-verified-engine.json`。

首次完整四组有4个旧Knight夹具被Wall早自爆测试经foxBoard共享hooks污染；Knight独立23/204全过。foxBoard改每局独立clone hooks，新增三断言证明不同游戏/共享默认不污染，Wall/Knight/Debater联合141/939通过且独立复查闭合；生产规则/断言/超时均未放宽。上一轮group1没有最终status，不能计通过；旧四组日志与已有status保留 `/tmp/awa-p8-wall-pre-isolation/`，上述verified为最终全部重跑证据。

初次夹具遗漏lastWords/self vote和SDK deadline包装丢权曾失败，按真实通路修复；自爆判例最初一狼导致终局、frontend sourceindex与PresentationReplay过滤后索引不同也已纠正。规则fixture临时deck参数遗漏曾导致候选49失败，修正后55全部通过。候选/失败日志 `/tmp/awa-wall-*` 留诊断，最终完整门禁只统计verified前缀。

未push/部署、无新branch/worktree、无真实模型或秘密/用户configs/系统设置。目录23verified/3implemented/38planned保持；P8既定三角色与首组有限事件道具完成，但总体尚待用户最终验收，P9/P10继续。下一项盗贼真实额外牌池和身份启用流程。
