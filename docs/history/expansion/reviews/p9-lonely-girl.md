# P9a 孤独少女首夜崇拜验收

接规则冻结525ea1b，唯一有限 `awa_netease_lonely_girl_v1`。[规则卡](../../rules/awa-netease-lonely-girl-v1.md)以网易现用num24孤独少女卡表为直接来源，2020暗恋者条款和2024少女放逐评分为辅助。首夜先选、胜利跟随、少女不知对象身份/对象不知被崇拜有来源；City/原Good民边、冻结原真实Camp、保留死亡后归属、原生命授权、mandatory窗口与有限组合明确AWA补全，不冒称完整官方preset或评分文裁定。

## 实现与独立复核

schema/default/serialize→原组件授权与独立状态→PM首夜前置→gateway→独立Victory→DTO/受限bot/双语提示→God/本人录制→strict parser/Tape→terminal/frontend/shared frame已贯通。标准N发牌，至多一Girl、七基础、City、N>=6、至少普通Wolf与非GirlGood，不与Hybrid/Cupid/Thief/Shape/WildChild或其它扩展/事件混用。公开6/12样例只在configs.example。

初始Girl/Good民边、Victory[]；选择另一原活人，一引擎窗口min1/max1、error/noFallback。绑定全部候选原body/life版本、Role/privateState/Camp引用与值、原Victory空数组引用及内容、config/阶段/原factory request和World，三deadline克隆继承原授权。factory/provider/gateway后重验，原子提交独立真实Good/Wolf membership；不换Role/Camp/库存，不获狼互认/夜聊/刀/自爆，不通知对象、不牵连。目标后续死亡/改变Camp不改冻结目标；Girl死亡不撤销个人胜利。Wolf City仍须清完所有真实Good，Girl支持Wolf也不能提前跳过它。

成功0/choice+单Faction，失败/撤权0/null+[]，World权威独立pending/active/complete/failed/cancelled。完成choice冻结副本与原可变state分离；原state访问器/替换不污染DTO/CP。失败审计取bootstrap授权原库存快照，不读取外来Role/privateState/Camp getter。closed窗口重复执行在try前拒绝，保原cancelled/failed及完整checkpoint不变；首夜当日Day/Voting jumpTo/递归cycle在phase/events修改前拒绝。Hybrid旧110阶段/choose_exemplar/三引擎尝试/两fact、状态与API保持。

God唯一五键 `lonely_girl_admired_chosen {policy,actorId,day:1,targetId,camp}`；本人同type lean四键无camp。对象和别人无事件，狼无关系知识。本人identity与提示始终Girl/Good；封盘公共winningPlayerIds允许必然推断，未承诺终局后不可推断。独立三键God checkpoint，无initialDeal；full/lean共享strict reader拒绝访问器/额外键/未知ID/错误日期阶段且不改身份/存活/徽。

record校验原12/6 roster Camp按原角色、内外request actor/day/stage/phase/min1/max1/required_any_tools/error、严格tool与唯一选择、各CP状态/Victory/事实时间、所有CP原Role/Camp；无owner或Hybrid夹Girl的fact/decision/tool/state/CP及Girl夹Hybrid均拒绝。真实ACP中途flush只带本周期decisions和上次CP events：唯一未finalized、仍仅cycle0 pending的中途档可以暂未包含选择fact；finalized或cycle>0有普通决定却无fact一律拒绝。独立probe确认中途档Tape拒绝reproduction_not_finalized，不将其计作可复现整档。

三路只读review原问题全部复查闭合：phase重入、原choice共用、失败getter、frontend关联表、cycle0伪关闭/cycle1 pending、元数据Camp伪造、取消后重跑和中途flush分别补实际反例。metadata/初始CP攻击此前完整Tape已拒，不把parser修补冒称旧执行旁路。

## 实际离线证据

60 Girl核心/553断言含非法/缺失、组件/生命周期/配置/Victory同数组污染/getter0、opaque跨World/deadline、PM真实连续两日Day/Voting重入、closed重跑、冻目标死亡与City末人；旧Hybrid38项回归保留。九6人剧本+三12人剧本×SDK HTTP/ACP子进程注入MCP/mixed×中英=72真实完整局，每局strict Tape，手写原Role/目标阵营/死亡列表/终局获胜名单；Girl原Good身份死亡后跟随Good/Wolf、对象死、同波死、Hunter枪连、Wolf最后必须清Girl均实际验证。另8 production SDK/ACP provider invalid/missing失败path partial Tape，ordinary技能/fallback均0；失败path用client/session stub，完整局才是实际HTTP/子进程通路，不混淆两类证据。

5有限板×20seed×双语=200受限ObservedBot自然整局逐Tape，0reject/fallback。独立World5×100×2=1000自然终局；跟随Good592/Wolf408、死亡后获胜222。World通过原Baseline策略取目标及原技能，不冒称受限观察通路；与Observed分别报告。

四实际God档与四实际本人档取自冻结源码全后端轮。16新增archive frame单元与2 strict display单元；8God/4本人实际Chromium新增。本人档严格private reader后构造最小共享帧，其他身份unknown，少女原Girl/Good保持、lean关系不含对象Camp；未新增UI原始private档直接导入功能。主代理目检中英实际12人PNG，12活人/少女Good身份、God关系与Wolf最终获胜7号一致，无遮挡。

## 最终冻结门禁

基线525ea1b，sourceHash `8ed214ef06268081ceb2f5d8c83f2bb044cbe6e37099cd58b6d4ffb6d0634009`，lockHash `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`。完整237后端文件四互斥组各跑一次：742/821/845/756通过，均退出0；耗时357.27/719.15/364.35/368.06秒。合计 **3164通过、0失败、318832断言**，原生产超时和断言未放宽。最终fixture刷新后前端 **312通过、0失败、3072断言/46文件**；最后完整Chromium **152通过、0失败/skip/flaky**，单worker零retry，退出0、171.8秒。root check/lint/format:check、双端build和git diff --check均退出0，已有bundle>500KB提示保持。

中间失败不计通过：首次库存用严格fact reader的深度上限读取native库存失败，改为原bootstrap可信库存structuredClone且保持fact reader限制；慢ACP中途flush误拒已补合法中途/最终严格区别；手写后夜夜死遗言误列已按现有AWA initial_wave条款修正；测试导入与RecordedGameEvent类型缺口已修复并check复验；第一轮全后端无完整退出证明，不计门禁，以末轮完整重跑及显式退出为准。没有放宽生产超时/断言/权限或调用商业模型。

证据均以 `/tmp/awa-p9-lonely-girl-` 前缀：verified-backend-manifest、四组.log/status与summary；transport-observed-third、world.json/world.log、十Observed report与十二组actual .record/.replay/.player；front-last、browser-last JSON/status/stderr及PNG，check-last及最终lint/format/build日志。最终全部退出0，登记23verified/7implemented/34planned；仅main本地commit、无push/部署/真实模型/用户configs秘密。接续鬼魂新娘/P9/P10，总体仍待用户最终验收。
