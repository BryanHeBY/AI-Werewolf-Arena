# P9a 千面人首夜身份选择验收

接规则冻结492fc8f与物理牌底座53c569d，唯一有限 `awa_netease_shapeshifter_two_extra_villagers_v1`。网易现用官方卡表直接支持首夜先选两身份之一、任一狼牌强制选狼；两额外Villager、City/七基础组合、至少两配置Wolf、N>=6和无混扩展均明确AWA补全，见[规则卡](../rules/awa-netease-shapeshifter-v1.md)。真实N+2一次shuffle，千面人可落底，候选两Wolf不早判空场；不重开、不重抽。0Wolf必选任一、1Wolf仅狼slot、2Wolf任一，与Thief的两Wolf强制/其它optional分别保留。

## 实现与复核

schema/default/serialize→原物理牌所有权→独立Shape状态→共用原请求/生命周期授权→PM首夜前置→gateway→真实native库存与同夜技能→双语私有提示/ObservedBot→God/本人录制→严格Tape→终端/frontend/shared frame完整贯通。6/12样例仅在configs.example。原Thief接口、policy、nullable选择、私有资源及旧档形状保持。

物理牌与actor/body/life/Role/privateState/Camp/Victory/config/阶段、候选slot/cardID/原主、factory原request/context一并绑定；三处deadline克隆继承原授权。构造、await、gateway、新native init之后重验。选择无await原子安装原生Role/Camp/Victory/库存，保姓名/ID/生命/徽/票/Agent/历史；原Shape资源成功0/slot，失败/撤权0/null，closed窗口不执行普通夜技能。原生Wolf同夜互认/夜聊/刀，原生神职同夜请求和Hunter死亡枪由手写实际剧本验证。

God物理checkpoint `shapeshifterSetup` 与原 `thiefSetup` 分开，原N+2/初始N玩家roster不可变。Shape选择fact六键、非nullslot；strict record对应原decision和内外actor/day/stage/required_tools/min1/max1、严格tool参数、原物理swap、新Role/Camp/Victory。所有原Thief/Shape跨owner事实、decision、tool、资源拒绝，不允许同档混挂。共享纯text工具reader避免recording反向依赖game。

三路源码复验问题全部闭合：chain发现record parser没绑定内外request和额外tool键，现以实际合法bootstrap/window两checkpoint档验证并拒绝五原攻击及wrong required_tools；完整Tape此前也拒绝请求伪造，不把parser缺口冒称执行旁路。delivery发现旧Thief parser可夹带Shape事实，现双向owner检查，15个实际档probe全通过。policy独立110测试/1464断言，gateway后与native init后死亡均取消、不换牌/不写选择fact，关闭原Shape资源。各审查只读、不修改源码。

## 实际离线证据

55核心/748断言包括mandatory三矩阵、非法/缺失、组件/牌主/slot/getter/原request/跨World/克隆deadline、PM/Night重入、native技能、严格失败Tape与6/12样例；保留Thief52核心与共用底座3。6人11剧本+12人5剧本×SDK HTTP/ACP子进程注入MCP/mixed×双语=96实际完整局，各逐strict Tape；同批原Thief90实际双语完整局逐Tape回归。8个Shape严格失败partial Tape及旧Thief8个均无fallback。最终全后端含所有这些测试。

5有限板×20seed×双语=200受限ObservedBot自然局逐Tape、0reject/fallback；独立World5×100×2=1000自然终局，千面人落底232、实际选择768，actor候选0/1/2Wolf分别358/360/50。World脚本通过本人choices DTO选allowed slot，其它阶段使用现有baseline，不冒称受限玩家观察证据；两类记录分别保留。

四实际God档与四实际本人档来自最终全后端冻结轮，进入frontend fixtures。本人档无God身份表/完整deal，只本人选择fact；严格读取后最小共享帧其它身份unknown、本人原Shape/Good→当前native，历史选择仍可读。17新单元/165断言，8God与4本人实际Chromium新增。本人浏览器路径采用严格private reader再构造最小共享帧，不声称UI新增原始private档直接导入功能。主代理目检最终中英12人PNG：选择事实/字幕、当前Wolf/阵营和12活人座位一致，无遮挡。

## 冻结源码最终门禁

基线53c569d，sourceHash `3ebd5cf85b4dec41aac142f25943a625853406956b7c87d9f6f164e85d62ce50`，lockHash `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`。生产冻结后完整233后端文件四互斥组各执行一次，741/803/818/687通过，耗时535.12/558.94/423.52/318.01秒，退出0；合计 **3049通过、0失败、303048断言**。原断言和生产超时保持。

前端完整 **294通过、0失败、2869断言/44文件**；root check/lint/format:check、双端build与git diff --check退出0，已有bundle>500KB提示保留。完整Chromium **140通过、0失败/skip/flaky**，单worker零retry、显式退出0。最终实际夹具刷新后重跑前端与全浏览器，证据以最后文件为准。

失败/中间轮不计通过证据：初始运输oracle未登记Shape阶段；坏档mutation改成已有Wolf是noop；recording依赖game违反架构，已将strict reader迁共享text；前端生成路径/私有档误入public glob/negative index钳制及label定位已修；第一次浏览器136过4失败来自测试猜测unknown翻译，改为既有raw unknown后全量通过，未改变生产显示。所有日志保留。

最终清单 `/tmp/awa-p9-shapeshifter-verified-backend-manifest.json`、四组 `verified-backend-{1..4}.{log,status.json}`、汇总 `verified-summary.json`；前端 `front-last.log`、浏览器 `browser-final.{json,status.json,stderr.log}`、静态及build `*-final.log`，末次 `check-last/lint-last/format-last.log`；全部带 `/tmp/awa-p9-shapeshifter-` 前缀。1000World `world.json/world-final.log`，Observed十板语言report、16实际God和相应actor档分别保留，不代替真实商业模型/T6质量。

登记implemented后目录 **23verified/6implemented/35planned**。仅main本地commit，未push/部署/真实模型或读取用户configs/秘密。下一项孤独少女规则与实现接续，整体P9/P10继续待用户最终验收。
