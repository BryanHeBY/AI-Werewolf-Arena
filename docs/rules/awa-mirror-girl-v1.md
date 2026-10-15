# AWA Mirror Girl 1.0.0 规则卡

规则集 `awa_classic` 1.0.0；ID `mirror_girl`，魔镜少女／Mirror Girl；核验日期2026-10-09。本卡对应有限AWA组合的角色实现，[功能验收](../history/expansion/reviews/p7-mirror-girl.md)记录实际范围；不把未交付的觉醒隐狼原板冒称已支持。

## 来源与版本边界

[网易镜隐迷踪发布稿](https://langrensha.com/news/official/20231113/26904_1119726.html)页署日期是 **2023-10-26**（URL路径不是发布日期）。正文明确每晚查一人的具体身份且不可重复；原十二人板为魔镜少女、女巫、猎人、守卫，三普通狼加觉醒隐狼，四民。两张附图是角色插画，不声称其中有完整规则。

[2023-10-26 官方完整讲解](https://www.bilibili.com/video/BV1z84y1R7Du/)的35秒屏幕规则再次确认魔镜不可查已经查过的玩家身份；126秒说明觉醒隐狼模仿当晚，魔镜看到的是被模仿身份。依据是官方账号发布的视频与屏幕规则帧，未声称取得字幕接口。觉醒隐狼的实际能力/标签/日夜生效要在其独立卡落地，不能用本段简介宣布整板交付。

[2026-07-10 官方赛事说明](https://langrensha.com/20260710/31012_1307230.html)保留上述配置并列出魔镜少女相关计分；赛事的未验人扣分不自动成为 AWA 引擎强制行动或竞技积分系统。[2026-03-06 官方沙龙说明](https://langrensha.com/news/official/20260306/26904_1289873.html)明确魔镜查到咒狐不会使其出局，表明具体角色查验与会触发查验伤害的技能须分开。咒狐及沙龙联合板尚未因此开放。

原文未精确规定本引擎阶段、self/null、合法跳过、实例来源/库存/转移、生命撤换及完整混合角色判例。以下逐项是 **AWA 选择**；本卡不冒充所有平台的同名版本，也不把通灵师、石像鬼或觉醒隐狼当成魔镜少女。

## mirror_girl

1. 原生最多1名，真实 Good 神职、Good 胜利，正常发言/投票/警长；无原生狼互认/夜聊/刀、自爆、保护、死亡枪或查验伤害。本卡描述兼容默认；`roles.mirror_girl.inspectionPolicy`可显式选有限AWA策略，见[配置契约](../history/expansion/contracts/role-policy-configuration.md)；未知self/时序/穿透/库存参数拒绝。
2. 原生 `role_check` 实例显式 `policy:"mirror"`。每夜女巫之后，独立600 `mirror_girl` 阶段，可以 `inspect_role {target_id:integer}` 查另一实际存活玩家的规则具体角色标签；不可self/dead/null，待刀/毒但尚未实际标死者仍可行动/被查。
3. **每实例跨整局不重复稳定玩家ID**，不因持有者或目标死亡/复活、目标变底牌/变阵营、座位重排而重置；持有者复活也不重新初始化原生实例历史。成功才追加 `{day,targetId,result:{kind:"role",role}}`、增加uses并关闭当夜；旧报告不因后续标签变化回写。不从 lastTarget 一个值猜完整历史。
4. 可以不调用工具跳过，关闭该实例本夜、uses不增加，lastTarget/lastDay/历史不变；null是Provider合法无行动，不是 `target_id:null`。没有其它存活未查对象时不请求、不造报告，同样关闭本夜。三次决策持续返回非法动作且仍有目标则明确运行失败，不把非法动作当合法跳过。
5. `gargoyle`旧缺省仍180禁重查且有专属原生查后刀；`psychic`仍600可跨夜重复。Mirror600不授权Garg查后刀；一个持有者多个policy实例分别调度/关闭/消费/保存历史，不由持有者真实底牌推测实例规则。未知policy拒绝。
6. 查验读取目标规则明示的 role label，遵守明确伪装，不额外附带camp/能力/瓶数/枪/队友/胜利归属。当前 HiddenWolf未接刀显示Villager、接刀后显示HiddenWolf；Gargoyle按自己的真实角色标签。镜隐迷踪中的觉醒隐狼标签与时序待该牌卡和联合矩阵，不用机械狼的模仿伪装代替。
7. 查验/skip只给本人，目标无通知；God复盘可完整记录，普通公开游戏事件和其它玩家档不接收。知道一个狼的标签也不授予狼队权限或历史；角色/阵营/人格/Agent/胜利归属不因查验或取得能力而改写。
8. 每实例拥有完整policy/history、lastTarget/lastDay、uses/lastUsedDay/disabled/时效。本版原生与明确 G02新copy/gift 初态为 `policy:"mirror"`、history[]、lastTarget/lastDay/lastUsedDay为null、uses0、disabled:false，生效夜/总次数由具体来源卡授权，不能暗带原持有者报告；其它复制语义必须由来源卡另冻。transfer保持全语义历史/库存/当夜关闭且不重复发旧报告；历史随能力实例，不拿其他实例或其他玩家的操作当禁查条件。角色学习/赠予来源组合仍由该来源角色的规则卡单独授权，低层API通过不代表联合板已开放。
9. 原actor role-kind/camp/privateState/ability **原ID、policy与来源归属**/state/生命与phase在 await/gateway/实际应用点复验。来源原生/赠予/复制/转移的分类及owner不能在等待期间改成另一归属而获得权限或省略abilityId。目标绑定原生命，报告按合法应用点的规则标签生成；撤权/转移/改ID/policy/来源/换状态/复活/取消后不向新实例报告、消费或关闭机会。gateway后及最终报告提交前再次检查目标仍未在该实例历史内，防同引用下新增记录绕过禁重查。
10. 真实查验、合法skip及无目标结束都登记本World/day提交；完整夜流水线拒绝已提交重入，保已消费/报告前缀。查验阶段不标死亡、不判胜；PM在死亡连锁、遗言、警徽等全部处理后判胜。
11. 当前有限联合白名单：MirrorGirl/Wolf/WolfKing/HiddenWolf/Gargoyle/Psychic/Seer/Witch/Guard/Hunter/Idiot/Villager/CursedFox/AwakenedHiddenWolf。双方角色白名单与数量在parse/direct bootstrap都验证。含咒狐须遵守[咒狐卡](netease-cursed-fox-v1.md)的单屠城等约束；含觉醒隐狼须遵守[觉醒隐狼卡](awa-awakened-hidden-wolf-v1.md)的七角色范围。列表不是笛卡尔积，不允许据此把咒狐与觉醒隐狼混在同板。奇迹商人、机械狼、混血儿及其它角色联合板另核验后扩展；不能只改其中一方列表宣布支持。
12. 六/十二 AWA 示例使用已交付角色。魔镜首次交付时尚未启用觉醒隐狼，四普通狼的十二人示例仍保留为 AWA 范围，不称原版完整镜隐迷踪。觉醒隐狼后来已独立交付，有限联合板及原组合独立场景见[觉醒隐狼卡](awa-awakened-hidden-wolf-v1.md)和[P7交付验收](../history/expansion/reviews/p7-awakened-hidden-wolf.md)；该验收证明其当时冻结输入，不扩大这两份原示例的范围。两语提示、工具/拒绝、私有报告与God复盘/前端/视频使用稳定机器字段，原话/昵称/人格不翻译。

## 验收要求

- 身份/camp/民神计数/数量/参数与有限组合；具体role vs Seer camp，Hidden伪装/接刀前后，非法/self/dead/null/错阶段/重复ID；合法skip/无目标关闭但不花uses，旧历史不回写。
- 原ID/policy/state/role/camp/原生命、gateway后新增历史、并发仅一次、已提交完整流水线重入；多个policy同actor及跨actor独立，gift/copy/transfer完整state、闭夜、未授知字段不泄露，nativeMirror禁重复不退化为Psychic。
- 两语实际SDK/ACP/MCP/混合字面完整局/Tape：首夜救镜女、连续不同目标、重复拒绝后纠正、合法跳过、无目标、隐藏狼接刀、猎人/狼王/警徽/最终判胜与十二人三夜；每板至少20受限seed且真实查验/skip正分支、每局严格Tape。
- 新policy须重验受影响Gargoyle/Psychic及G02能力通路；中英真实提示和反馈、actor-only/God事件、console/录制/共享reader/前端纯frame一致；unit/type/build、实际Chromium/双语实际PNG，R/A/T/L/D独立审查和修正复查。
- 完整启用笔才标verified。P7三角色、P8–P10、64/22、T6真实模型和长局目标保持。
