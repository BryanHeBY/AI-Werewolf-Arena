# P9a 野孩子：榜样死亡后的阵营变化

状态：有限策略已implemented，三组审查/原报告复验与最终离线完整门禁见[角色验收](../history/expansion/reviews/p9-wild-child.md)。唯一首批AWA适配 `awa_lui_meme_wild_child_v1`，不称网易完整预设。

## 来源

发行商《Characters》2013规则书印刷16–17页（PDF第9面/索引8）及末尾首夜顺序：[原版规则书](https://cdn.1j1ju.com/medias/14/fc/6d-the-werewolves-of-millers-hollow-characters-rulebook.pdf)。Wild Child初属Villager，首夜选榜样；榜样被淘汰后变成Werewolf，从接下来一夜跟狼群行动。榜样本身是什么阵营无关，野孩子可参与淘汰榜样；胜利跟随其实际阵营。书末首夜唤醒次序把Wild Child放在Cupid/情侣之后。

公开二手中文材料对“所有死因/仅放逐”和“变身/判胜先后”说法不同，不据二手差异增加无来源preset。本批从可读发行商正文选主规则，后文未获书中明文规定的扩展裁定均标AWA工程补全。

## 首批有限支持

WildChild至多一个，与普通Wolf/Villager/Seer/Witch/Hunter/Guard/Idiot，City胜利。至少一个初始普通Wolf和一个非WildChildGood。事件包、Thief/Cupid/其它扩展未核验组合明确拒绝，不将书末全部兼容建议冒称AWA已验证。标准N牌发牌，无新增额外牌。保留wild_child身份标识以表现角色来源，真实Camp与Victory独立更新，不改成普通Wolf角色而丢榜样事实。

第1实际夜在Wolf/所有普通夜技能之前必选一个其它活人榜样，一局一次、不可跳过/延期、min1/max1/noFallback；noSelf和活人目标是本有限接口的AWA支持限制。选择不获其角色/阵营，也不通知榜样。固定原ID与实际玩家主体，actor与目标life/Role/state、配置/phase/request晚校验；失败关闭初始窗口并阻止普通技能，不自动选榜样。原始身份/阵营/会话历史提示沿盗贼历史身份语境；本轮状态为准。

## 死亡、变身与下一夜

只在引擎实际提交榜样淘汰时触发，外部alive篡改、未提交枪proposal或被救/免死不是淘汰。所有死因都可触发；没有额外免毒/免枪/免放逐。榜样角色或阵营后来变化不改绑定主体，不换榜样、不复制榜样技能。选择成功后固定榜样原Alive对象/version与主体；外部false→true复活、Alive替换或新生命死亡不能兑现旧关系。已实际触发后榜样复活不撤销或再触发变身；野孩子自身死亡再复活永久撤权。

AWA工程补全：只变更仍活着、原主体/生命/角色/state授权有效的野孩子；已死亡野孩子不因未来榜样死亡或外部复活重获身份/改胜利，完整同波次两人均死不转。“同波次”指DeathResolution完整pending死亡批，而不是一次逐人mark调用：初始整批实际死者先全部标记，再在任何死亡hook/遗言/徽/枪await前处理转换；追加枪proposal也须整组真实accepted/committed死者全标记后才转换。两根Hunter同一追加波分别击杀榜样与野孩子，交换ID或hook顺序均不转。榜样Hunter在首波死亡、孩子仍活，则当波先变Wolf；后续枪波杀孩子时以Wolf死亡且不activation。变身发生在实际完整死亡波次后、完整链最终Judge前，最后初始Wolf榜样死亡仍可能留下真实Wolf野孩子，不提前以初始清狼封盘。该复合/边界时点不是发行商明文全平台裁定。

保持Role=WildChild，在无await的一个提交同步换当前Role.camp/Camp与faction Victory为Wolf，并验证原组件/私有state，记录一次变身和`eligibleNight=死亡所在day+1`。姓名/座位/Alive/徽/票/Agent历史保原主体。保留榜样source事实与原资源，没有God能力或药/枪刷新。变身时仍无狼互认/chat/knife，进入下一真实Night前置activation后才取得双向互认/recognizedByPack、chat与knife；activation只由实际Night入口一次提交，不能由权限查询/请求day/state标签触发。跳过夜次则在eligibleNight之后首个实际Night激活；入口重入在PhaseManager改phase或发事件前拒绝；模型死亡在Night1或Day1均从Night2入群。不补以前的私有狼队事件。仅WildChild不授予canSelfDestruct；普通Wolf保留现有selfDestructWindows配置，普通Wolf榜样真实自爆也触发转换。是否扩展孩子自爆权限待来源与实际通路核验，不假设原版自爆。

## 受众、知识与录制

选择/变身/activation只本人和God事实；普通玩家无选择/身份变化关联。自己的 DTO 保 ID/remaining/status/eligibleNight，不暴露榜样身份/阵营、God全局seq或隐藏毒因；God可有完整已提交死亡波次/真实死因因果。Seer按当前camp查，具体role按WildChild；基础City按当前camp计数。未activate的真正Wolf仍计作Wolf、无行动权限。公共板子给配置候选，不按实时World camp反推隐藏变身。

runner/manifest/Tape共享不可变原始N玩家roster(role+camp)，不能仅在Thief拓扑保存初始身份。God档初值仍原WildChild/Good，变身事实对应时间才更新camp；不改变alive/徽，公共明牌仅既有disclosure策略真实死亡事件产生。元数据/中间及最终checkpoint保存选择、变身与activation阶段，当前Tape重执行相同触发点/权限和终局。坏初始/资源/阶段/actor/模型因果/身份归属篡改严格拒绝；不能凭序列化token借跨World或过期窗口权限。

## 手写实际判例及门禁

- 首夜必选、self/dead/null/未知拒绝；晚role/life/body/config/phase/榜样撤权无消费、无更换；factory/SDK/ACP/MCP原请求与截止克隆保持权限。
- 选Good/Wolf两类榜样均不改变初始阵营；可以投榜样；没有榜样阵营泄露。
- 模型首夜刀/毒、首日放逐/原生Hunter枪与普通Wolf榜样自爆分别触发下一夜入群；救活、Idiot免死、未提交枪不触发。
- 最后原Wolf榜样死亡不早封Good；未激活真实Wolf不互认/刀；下一夜正常pack权限；不获取旧私有事件。
- WildChild先死、两者同波次死、死亡链晚枪、后续榜样变化/复活与actor外部复活、再次Night/死亡重入不刷新；徽/票/原始身份及公共明牌保持。
- 6/12字面完整局 ×SDK/ACP子进程注入MCP/mixed×双语及逐Tape；20–50受限种子、World独立oracle、坏录制与实际God前端/浏览器/video frame，以及静态/完整门禁。

所有工程补全绑定这个明确AWA版本；无额外可配置无来源布尔组合。整体P9/P10仍待用户最终验收。

三组只读方案审查已闭合来源、自爆主体、完整波次/晚枪、原生命绑定、同步阵营/胜利提交、双向权限、实际Night入口及原始roster回放边界；功能已在真实实现与最终门禁后登记implemented；总体仍待用户最终验收。
