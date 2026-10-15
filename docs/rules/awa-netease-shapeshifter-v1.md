# P9a 千面人：首夜必选身份与一狼强制

状态：有限策略已实现并登记 implemented，三组来源/规则与源码复验已闭合；最终离线证据见[验收记录](../history/expansion/reviews/p9-shapeshifter.md)。唯一有限AWA策略 `awa_netease_shapeshifter_two_extra_villagers_v1`，机器角色ID `shapeshifter` 保留与 `thief` 分别登记。

## 原始来源与差异

网易官网现用[卡牌脚本](https://langrensha.res.netease.com/pc/gw/20190509150909/js/kapaiData_02806e2.js) 千面人条目：第一夜所有其它人之前，从两张备选身份中选一张；备选出现狼牌就必须选狼。2026-10-09真实读取公开脚本HTTP成功，原字节SHA256 `e1884729ff09aea650ba16e2c3cf94f0bd60e97263a267e2addc5626bd07bf3c`，缓存 `/tmp/awa-p9-kapai-oct9.js`。URL中的201905时间不证明当前正文发布日期，不把缓存年份当官方版本年份。没有采用二手“同盗贼”推断。

已有发行商Thief策略为两Wolf才强制，其余组合可保留原Good盗贼；本千面人必选（即使没有狼牌），只要一Wolf就只能选那个Wolf；两Wolf可选任一。官方短卡没有给出额外牌构成、完整随机发牌办法、两Wolf重开、缺席底牌处理或混合角色规则，这些必须独立标AWA工程补全，不声明完整网易preset。

## 唯一有限板子与发牌

最多一个Shapeshifter，与普通Wolf/Villager/Seer/Witch/Hunter/Guard/Idiot，City，N>=6。源配置N角色，额外加两张普通Villager，真实N+2同一deal流shuffle，发前N张、剩两张为候选。这是本AWA明确工程选择，不从短卡推导通用额外池；允许千面人或神职落底，不保送或重抽。至少配置两普通Wolf、一非ShapeshifterGood；这一有限支持限制保证Shapeshifter落底时仍有至少一只场上Wolf，不重抽或改写随机发牌。两Wolf底牌时不得早判原场0Wolf，必须先完成选择取得真实Wolf；没有“两狼重开”变体。Thief/其它扩展/事件包拒绝；新native身份首夜启用其实际基础技能。

底牌有Shapeshifter则无人取得此牌，setup在普通夜技能前一次完成、无选择请求/事实，实际其它角色可正常终局。公共板定义显示N原候选与N+2候选计数和两未知底牌，不能把候选计数冒为场上人数或泄露底牌。不得虚构必有千面人玩家。

## 选择、授权与原子生效

初始Shapeshifter/Good民边，无神技能/狼权限；第一实际Night在其它技能前唯一 `shapeshifter` 窗口与 `choose_shapeshifter_card {slot:0|1}`，min1/max1/noFallback/error，无null保留。0Wolf任选一个、1Wolf仅狼slot、2Wolf任选一个；无未知/越界/自制角色/第三slot或第二次选择。不能选择“保留千面人”。其本人只知道两slot身份，不得到其它玩家身份。

请求约束独立表达 `mustChoose=true` 和本人 `allowedSlots`：以下0/1/2均为两底牌里的普通Wolf数，0→[0,1]、1→仅Wolf所在slot、2→[0,1]。所有三种原factory请求 `requiresAction=true`；gateway/阶段提示/ObservedBot/SDK与ACP修复/Tape共用该有限矩阵，不能拿Thief的required布尔推导slot。opaque权限绑定本World、原角色/具名policy/tool/stage/config与原context，跨角色和跨World不能继承。

共享底座持唯一World原物理牌与ready/active/nightCommit。PM、NightPipeline和wolf_team知识统一使用generic门禁：pending/active/failed/cancelled均不得开启普通权限；完成初始设置才释放。Day/Voting同日重入在setPhase前拒绝。旧Thief API仅识别Thief owner，不能把Shape投影成Thief；共同N+2原牌/候选count读取供runtime/manifest/Tape，state与事件/序列化分派分别保持角色身份，原Thief policy/nullable选择/旧档逐字兼容。

共用初始身份底牌授权底座承载原World/玩家/life/Role/privateState/Camp/Victory/物理卡主/槽/配置/阶段、opaque factory原请求以及仅deadline克隆；Thief专有public API和旧政策/字段/档形保持兼容，不能把其原有optional窗口变成mandatory。一局一次窗口与实际Night commit、PM Day/Voting重入、构造/await/gateway后终验、非法/取消/异常finally关闭。撤权不换牌、不消耗原生新角色库存、不运行普通夜技能。失败记录partial Tape；不能native fallback代选。

先准备新Role/Camp/Victory/本角色原生库存，再无await同步提交所选物理卡到原座位，原Shapeshifter实体牌归所选slot、另一slot不动。新身份完全原生实例，不copy目标玩家能力；原姓名/ID/Alive/徽/票/Agent/历史不换。新Wolf首夜互认、夜聊和刀；新神职首夜实际阶段/资源，新Hunter可当夜真实死亡枪；初始0场上Wolf必须等选择完成再Judge。

## 事件、提示与严格回放

独立shapeshifter初始deal/identity_chosen事实和私有state，不能把Thief事实label硬改。God完整deal/physical cards/checkpoint；本人两slot、强制状态/选择事实，其他玩家无底牌/选择事实。当前身份/阵营/资源为每轮提示依据，系统初始语句有历史语境。

新checkpoint字段明确 `shapeshifterSetup`（与Thief原 `thiefSetup` 形状相同的物理hands/reserve/selection字段，仅归属相应角色）；新role私有 `shapeshifter` 精确三键 `{policy,remaining:0|1,choice:0|1|null}`，pending为1/null，实际选择后0/slot，失败closed初始窗且0/null；setup自己的status另保pending/complete/cancelled/failed。本人DTO提供真实两slot、`mustChoose`/`allowedSlots`，选择后当前native身份/库存不保留旧Shape伪能力。God `shapeshifter_initial_deal` payload精确 `{policy,boardSize,roles}`，`shapeshifter_identity_chosen`精确 `{policy,actorId,day:1,slot:0|1,role,camp}` 无null。choice必须对应唯一原day1/Night/shapeshifter decision的tool/slot，所选原物理牌与实际swap、新Role/camp/Victory一致；同步改事件/checkpoint/库存也不能绕过原decision。record metadata.initialDeal按roleSetups中的唯一初始底牌机制分派，禁止无机制出现full-deal或混挂两角色checkpoint；普通旧档/旧Thief档保持原形。

metadata保完整原N+2与不可变原N玩家roster，初始回放Shapeshifter/Good，选择事实时改变Role/Camp而不改变Alive/徽/公开明牌。new-current strict Tape核对牌多重集/位置/cardID、原初身份、强制slot规则、pending/选择/完整/失败和最终库存身份；0Wolf时null、1Wolf选非Wolf、二次/错误actor/新生命/跨World均拒绝。旧Thief记录与原基础记录语义保持。

共享中英文事件reader/label、终端、前端关联/身份投影与video frame同步（必须包含God与本人两种实际归档，换角色后仍能读历史选择事实），并拒绝坏fact/getter。6/12样例只落configs.example，不碰用户configs。

## 人工判例与验收

6人实际剧本：0Wolf底牌必选God/Villager、1Wolf在slot0/slot1仅能选狼、两Wolf两个slot、其它每种基础新身份的首夜实际请求/原生资源/被动死亡枪、Shapeshifter落底；12人含0/1/2Wolf底牌与新神职/缺席。手写计划不从生产World生成预期。

核心覆盖一次真实N+2、1Wolf误选/null/required失败、0Wolf null不保留、late组件/底牌原主/slot/getter/配置/阶段撤权、两World/原请求/仅deadline、Night及Day/Voting重入、私有受众、原roster和坏档。实际SDK HTTP/ACP子进程MCP/mixed双语完整局逐Tape；200受限ObservedBot自然局逐Tape；1000独立World自然局。至少两组独立审查，高风险三个原审查者复验，静态/完整backend/frontend/浏览器与实际PNG/shared frame。未授权真实商业模型，T6不声明完成；总体P9/P10继续待用户最终验收。

三组复审已闭合：≥2配置Wolf排除无actor/零Wolf空方、独立mustChoose/allowedSlots、共享原物理牌/opaque权限/generic PM与狼知识门禁、分别序列化原Thief与Shape、选择因果交叉原decision/slot/库存、God/本人实际前端归档。三项共享架构边界保留为实际源码审查门禁，规则冻结与最终功能验收分别记录；最终功能证据以验收记录为准。
