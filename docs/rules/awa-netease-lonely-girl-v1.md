# P9a 孤独少女：首夜崇拜与独立胜利归属

状态：implemented；本卡有限策略已交付，来源／规则与运行审查及最终离线证据见[验收记录](../history/expansion/reviews/p9-lonely-girl.md)。该记录对应当时冻结输入，不表示当前重构源码全量通过或其它组合已支持。唯一有限策略 `awa_netease_lonely_girl_v1`；机器ID `lonely_girl`，不改名或复用 `hybrid` 的状态/工具/事实身份。

## 原始来源与适配边界

网易官网现用[卡牌脚本](https://langrensha.res.netease.com/pc/gw/20190509150909/js/kapaiData_02806e2.js) num24 孤独少女描述首夜开始先选择崇拜对象、获胜条件跟随对象；少女不知道对象身份，对象不知道被崇拜。2026-10-09实际读取的原字节SHA256 `e1884729ff09aea650ba16e2c3cf94f0bd60e97263a267e2addc5626bd07bf3c`，缓存 `/tmp/awa-p9-kapai-oct9.js`；用正则取JSON字符串并json解码，不执行JS。URL年份不作为当前正文发布日期。

网易[2020-03-03暗恋者表演赛官方说明](https://langrensha.com/news/official/20200302/26904_866894.html)另列4Wolf/Seer/Witch/Hunter/Guard/3Villager/1暗恋者及首夜选择、相同胜利条件、少女不知道对象身份、对象不知道被崇拜。它支持相近的选择/秘密语义，不能据此断言两个名称的所有玩法相同。本实现以num24孤独少女为直接来源，不把完整2020暗恋者preset或额外同名规则冒称已还原。

网易[2024-03-05赛事评分规则](https://langrensha.com/20240305/31024_1141587.html)另明确少女放逐投票时始终按平民身份计分，无论崇拜对象派别；这是赛事评分身份依据，不冒称它已明确裁定AWA City计数或预言家查验。

以下首夜必选其他活人、min1/max1无fallback、真实Good民边不随对象改Camp/刀权、提交时冻结真实Camp、死亡后归属保留、原生命晚撤权及有限组合均为明确AWA工程补全。短卡没有裁定阵营计数、查验伪装、重选、死亡获胜或目标未来变阵营。只实现有来源的首夜崇拜、获胜跟随和双方秘密，不开放无来源任意改Camp/互认/复制/连死选项。

## 有限角色与胜利

最多1LonelyGirl+7基础角色，City，N>=6，配置至少1普通Wolf和1非GirlGood；标准N牌，不使用额外底牌/身份换牌。拒绝Thief/Shape/WildChild/Cupid/其它扩展/事件包，避免没有来源的转换/第三方/双关系混合。

原Role LonelyGirl、Camp Good、民边，初始Victory affiliations显式[]。选择另一当前活人；初始化时保存所有候选原主体、Alive生命、Role/privateState与Camp组件引用及值；在首夜窗口和提交前匹配原实例（替换、篡改或访问器均撤权）。合法提交点的有效真实Camp必须与不可变初始roster一致，只冻结其真实Good/Wolf Camp为独立Faction affiliation，不读伪装查验标签/对象胜利归属或终局结果。自身Role/Camp/民计数/查验Good保持，不获得狼互认/夜聊/刀/自爆或目标原生库存。目标后续死亡/复活/角色变化不改已经独立提交的membership；双方死亡也不撤销。Good判胜清完真实Wolf，Wolf City必须清完真实Good（仍包括支持Wolf的Girl）；不将Girl算作第五只实际Wolf，也不续狼刀。封盘获胜玩家可包含死者，无胜者不产生个人胜利。

## 首夜选择与权限

第一实际Night所有普通夜技能前，唯一 `lonely_girl` 窗口与 `choose_admired_player {target_id:integer}`，mandatory min1/max1、noFallback/error；不可self/dead/null/重复/后夜。无有效目标或缺失/非法回复明确失败，不代选。合法接受与实际应用分开，晚失效不安装归属、不误消耗新主体库存。

可提取首夜affiliation检查与同步提交helpers，LonelyGirl独立控制器；原Hybrid的priority110、choose_exemplar、三次引擎尝试、状态/事件/错误/hasHybridNightCommit/API完整保留，不自动迁移其策略。绑定本World、原actor Role/privateState/Camp/Victory、原life、目标原life/Role/Camp、config与isCurrent，原factory请求opaque，跨World/角色不能继承，仅deadline克隆有效。await、gateway后和同步应用前终验；原Victory及其affiliations数组必须保原引用和精确空内容，数组替换或同引用非空都撤权；原Victory必须仍为空，无await同步写选择机会/choice和独立membership。选择期间或实际普通夜/当日Day/Voting重入在phase/events修改前拒绝。异常/撤权finally关闭原资源；不消费替换主体或外部新状态。初始pending为1/null+Victory[]，成功complete为0/choice+单独Faction，failed/cancelled为0/null+Victory[]。setup status独立由World权威保存；pending/active/failed/cancelled禁止普通夜技能绕过。状态被外部替换/变getter时不执行它，而按已绑定原值给安全审计投影；不能把不可信组件伪装成成功。失败partial Tape无默认Good/Wolf胜利归属。

私有 state 精确 `{policy,remaining:0|1,choice:{day:1,targetId:number}|null}`；本人只知道对象编号与机会，不含其身份/阵营/冻结affiliation。目标无通知，别人无关系事实，狼不获知Girl。玩家identity与当前提示始终Girl/Good。封盘前不直接投影冻结affiliation或对象Camp；终局公共winningPlayerIds及本人胜负允许必然的阵营推断，不承诺胜利揭晓后不可推断。仍不额外输出targetCamp/关系字段。当前nativeGod/Alive/徽/票/Agent/原始roster不替换。

## 录制、消费与人工判例

唯一God事实type `lonely_girl_admired_chosen` payload精确 `{policy,actorId,day:1,targetId,camp}`；本人记录同type投影精确 `{policy,actorId,day:1,targetId}`，不另生成第二事实。两个schema由严格typed reader区别God/lean受众，禁止额外键/getter、God camp泄到DTO/本人录制。God checkpoint增加独立 `lonelyGirlSetup:{policy,status,actorId}`，普通档/Hybrid档不含它；初始original roster是普通N，无initialDeal。严格当前Tape绑定唯一原decision、对象原始实际Camp、选择时点、每checkpoint私有状态及Victory；同步伪造事实/状态/membership不能绕过原decision和不可变初始roster。无Girl owner或Hybrid档混挂上述事实、decision/stage/tool、privateState/checkpoint一律拒绝；Girl档混挂Hybrid选择事实同样拒绝。旧Hybrid/基础档原shape、工具名与可见性不改变。

schema→init/原实例→PM/window→gateway晚验证→DTO/ObservedBot→中英提示/错误/工具→God/本人record→strict Tape→terminal/frontend/sharedframe完整交付，6/12 public样例只写configs.example。God与本人实际档验证关系不改角色/阵营/存活/警徽，终局展示实际Good身份的Wolf侧或死者获胜；本人关系事实不直接显示目标阵营，终局胜负名单遵守上述推断边界。

手写6/12 Good/Wolf对象、双方分别死亡与同波死亡、最后原Wolf死Good封盘、Wolf必须清Girl、未知初始membership、self/dead/null/缺目标/后夜/重选、15类late组件/生命/配置/gateway撤权、Victory同引用非空、getter0/opaque跨World与deadline、PM各阶段重入、坏档。实际SDK HTTP/ACP子进程MCP/mixed双语完整局逐Tape、8严格失败partial Tape、200受限Observed逐Tape、1000独立World、三组原审查者及所有离线门禁。未授权商业真实模型，T6不声明完成；总体P9/P10待用户最终验收。
