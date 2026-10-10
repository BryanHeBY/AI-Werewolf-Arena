# P9a 鬼魂新娘完整功能验收

基线 `68e0c5a`，原目录 main 线性本地实施。唯一 `awa_melbourne_ghost_bride_v1`，12人三狼四民、预言家/女巫/猎人/守卫/鬼魂新娘。来源为 Melbourne Masters 2026 的[指定板子](https://melbournemasters.org/setups/gui-hun-xin-niang)及[角色页](https://melbournemasters.org/setups/roles/%E9%AC%BC%E9%AD%82%E6%96%B0%E5%A8%98)，不是网易或全部同名规则。具名 AWA 补全与有限组合见[规则卡](../rules/awa-melbourne-ghost-bride-v1.md)。公开[示例](../../../configs.example/boards/awa_melbourne_ghost_bride_12_v1.json)实际解析/初始化；额外角色、非三方目标、活动、自救、可重复守护、其它枪策略等未支持组合明确拒绝。

## 完整执行与授权

首夜新娘必选新郎、两人各一次私聊（空串显式结束）、新娘提名与新郎同号确认。两票保存原请求/原scope/原组件、生命版本与deadline；第一份原证明在第二次域提交时再校验。其它角色与未完成窗口不能先行动。错误、缺失、分歧、撤权及预算过期保留真实前缀，finally关闭、不随机代投。deadline克隆只沿三个真实交付入口授权；普通副本没有权限。合法动作直到域提交才记accepted，chat直到一次实际合法receipt后才记action；gateway操作也与实际提交一致。

原生 Role/Camp/privateState 引用保持；情侣及证婚人只独立转 ThirdParty Victory，原狼不进入普通包互认、夜聊、刀票与自爆。Bride被预言家验好，原神职继续原生技能及独立库存。每夜只捕获一次普通狼→双情侣→证婚人→无刀的owner，捕获后失效不降级、不补刀；情侣/证婚人严格刀票复用 Guard/Witch 和同守同救。后夜先合法情侣chat，再 Guard→普通狼聊→唯一刀→Witch→Seer。

刀提交持有原owner与目标证明，跨 NightPipeline await 至 PM 实际标死前再次校验；失效只去除 WolfKill，独立Poison保留。独立根与双根先闭包情侣殉情，再按固定枪死因表；完整所有波次、遗言、警徽与枪完成后才判三方胜利。Night终局也在完整死亡链后先发布night_resolved全部死亡ID，实际Night6仅3号存活、Night5全灭12人的前端/sharedframe逐人Alive与原CP一致；不会只封盘让最后夜死留为活人。普通狼自爆吞全部原徽并锁后续竞选/授徽；婚礼成员三层拒自爆。夜间终局在 Phase.Night 封盘，公共 VictoryPoint 的 night_settled 兼容 Night 与旧 Day，其它checkpoint阶段约束保持。三方只剩一方则全员（含死者）获胜，全灭显式 no_winner，不沿旧City默认。

## 私有矩阵与严格录制

God完整事实；情侣见本人原身份库存、伙伴号、独立目标、合法chat及一致后证婚人号；证婚人见本人原库存、情侣号与本人刀权，不见chat、原两票或伙伴身份库存；普通狼无任何 Ghost fact/groupId。每次请求的visible feed、observation、system/user prompt、原生狼队与最终本人档同时验证。shared strict事实reader及前端不借婚礼事实改变原身份、Camp、Alive或徽。

CP严格保存原roster、Goal和原生库存；失败审计逐玩家安全刷新合法消费，getter/proxy被替换的玩家保留最后合法缓存。反射前拒Proxy，getter/陷阱零次执行。parser拒伪第四狼、消失库存、未关闭失败、非法可见事实、跨板挂载、缺owner/捕获/票、伪complete和不可能的串行后续decision。未finalized只允许真实中途CP/decision前缀；pending setup为最后decision，不能当完整Tape消费。原基础与提交边界历史证据见[foundation](p9-ghost-bride-foundation.md)/[delivery](p9-ghost-bride-delivery.md)，其planned说明保留对应提交时点。

## 实际离线证据

4个独立手写整局（Good、Wolf、情侣存活Third、证婚人继承Third）×SDK本机HTTP/ACP实际子进程注入MCP/mixed×中英=24完整局，每局严格Tape比较决定、事件、CP和logic_ops，人工oracle不调用生产World判定。另生产SDK/ACP provider×invalid/missing×中英=8失败partialTape，普通行动与fallback均0；失败provider使用client/session stub，不冒称HTTP/子进程完整通路。

18 actual reproduction判例包括三方完整获胜、5种婚礼失败、getter/嵌套Proxy零副作用、Witch消费后Seer失败、Night6先于Day封盘、pending中途前缀、情侣刀+毒+猎人枪+殉情全灭及Hunter新郎/Witch证婚人实际独立扣枪毒。最后两条分别验证完整多波死亡后Night5平局和证婚人随后继承刀，死者也在获胜名单。

100seed×双语=200受限Observed自然终局逐Tape，Good58/Wolf114/Third22/draw6，零fallback。每种语言各有同一seed43的1次blind Hunter shoot_target拒绝：尝试5号时其夜死尚未公开；操作、目标和原因精确断言并严格复放。不把其写成零reject，也不把隐藏Alive喂给bot。独立World500seed×双语=1000自然终局，同为受限Observed策略：Wolf582/Good286/Third98/draw34，死亡获胜成员1990次，逐局独立核对原角色/原Camp/库存引用、三方全名单、每夜单owner与受众，逐局公开死亡ID投影与真实Alive一致。

4份God和16份本人完整实际档来自真实transport，另2份实际夜终局God档与原最终CP来自actual reproduction。前端新增52单测与20 Chromium：四scope私有读档→最小shared frame，其它身份unknown，Witness不见chat、pack无Ghost事实，保原Role/Camp。未提供UI原始private档直接导入；没有把最小帧当整私有档导入。主代理目检中英婚礼/终局PNG，号码、角色及死亡获胜标识清楚，字幕与座位不重叠。

## 最终冻结门禁

engine指纹只覆盖core/game/app及共享catalog/text/replay源码，另有全测试文件清单，不将其冒称整个仓库hash。sourceHash `efc782adcb719c012034151b212a66ca7035f53c25d6c5829201dbbacb57ce6f`；lockHash `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`。后端全量3315通过/0失败/329141断言/246文件，四互斥分片808/839/885/783，全部退出0，最长695.91秒；精确并集manifest不含重复文件。前端364通过/3862断言/48文件，完整Chromium172通过/0失败、skip、flaky，2workers/0retry，134.10秒。root check/lint/format:check、双端build与diff通过；已有bundle>500KB提示保留。

三组只读原审查者复验关闭：Night到PM提前关窗、Day殉情漏公开ID、普通狼后续visible leak、成功action先于域提交、受信chat投递、getter安全库存、合法消费后失败库存丢失、嵌套Proxy陷阱、pending后虚构decision及严格失败schema。最后复查无剩余源码阻断。首次观察运行发现Night胜利点仍只允许Day、完整CP的自爆handoff时点、最后合法库存及普通狼God刀fact错误可见，均有精确反例并重新实际Tape。首次全后端发现Ghost机械组合旧诊断断言和缺三方胜利i18n规则标签；仅修正Ghost特定诊断预期并补共享双语标签。原全量中未完成两组及重复启动组在最终夜终局公开死亡修复前取消，旧失败/取消日志保留、不计最终门禁。最终冻结生产后全部四组重新完整跑。前端实际CP最初放在顶层replay夹具目录引起3项扫描失败，移到独立checkpoints目录并更新实际CP断言路径后，全前端与172浏览器重跑通过；扫描器不放宽。

所有证据以 `/tmp/awa-p9-ghost-bride-` 前缀：final-backend-manifest/四组log与status/summary，observed-{zh-CN,en}.json，world.json/world-final.log，config-final1、terminal-final1、安全及strictfailure日志，frontend-final2、browser-final2.json/stderr与双语婚礼/终局/draw PNG，check-final3、lint-final2、最终格式及build-{backend,frontend}-final。仅main本地原子commit，无push/部署/真实模型或用户configs/秘密操作。登记23verified/8implemented/33planned；P9a五角色技术功能完成，P9b–P9f/P10和用户最终验收继续，不关闭总体任务。
