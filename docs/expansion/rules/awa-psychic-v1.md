# AWA Spirit Seer 1.0.0 规则卡

awa_classic 1.0.0 角色扩展，核验2026-10-08，ID `psychic`，通灵师／Spirit Seer。采用普通具体身份查验，不把魔镜少女、石像鬼、机械狼和觉醒隐狼当同一版本。

## psychic

- Good神职，Good胜利归属，原生最多1；正常公共发言、警长、投票，没有原生狼互认/夜聊/刀、自爆/死亡枪或保护。
- 每夜女巫后优先600的独立 `psychic` 阶段，可用 `inspect_role {target_id:number}` 查另一实际存活玩家的规则role标签。允许跨夜重复查同ID，不可自验/死者/null目标；当夜待刀/毒但尚未提交死亡者仍存活，可查也可行动。
- 新原生 `role_check` 实例显式携带 `policy:"psychic"`。石像鬼旧缺省／`gargoyle` policy仍180、禁重复、有效目标必须查、专有查后刀；同一持有者的不同policy实例分别调度、消费、保存history，不从持有者真实底牌猜规则。
- 每实例每夜一次机会，可以不调用工具跳过；真正null决策关闭本夜机会，lastUsedDay记本夜、uses不增加、旧lastTarget/lastDay/报告不改。无其它活目标时不请求、不伪造报告，同样关闭本夜机会且不增加uses。可跳过不等于非法三次回复自动当合法跳过：仍有目标且持续返回非法工具/参数则明确运行错误。
- 合法查验增加uses并保存独立 `{day,targetId,result:{kind:"role",role}}`。读取规则标签尊重明确伪装，P6隐狼在未接刀时显示Villager、接刀后Hidden Wolf；过去报告不回写。具体role不附加camp、能力、资源、队友知识或无权历史。
- 实际本人独占报告与skip事件，目标无通知；公共终端/chat不展示私有信息，上帝复盘可以完整展示。知道某狼不授予狼队关系或刀权，gift/copy不改变真实身份/阵营。
- await/gateway/提交点绑定原role-kind/camp/privateState/ability/state/policy/life及版本和阶段clock；目标绑定原生命。撤权、转移、换状态、复活、取消或迟到不报告/消费/关闭新实例机会；已提交前缀保留。
- 普通查验和合法skip/无目标结束均登记本World/day提交，完整夜流水线拒已提交重入。它不记录或授权Garg原生查后刀完成；Garg赠予psychic不能代替其原生gargoyle流程。

## 资源、转移与参数

每个实例拥有完整policy/history/lastTarget/lastDay与uses/lastUsedDay/disabled/时效。gift/copy由角色规则明确初态和资源，不能用来源角色或查验label自动推定；transfer保完整语义state/policy、资源与本夜关闭，明确授权新持有者旧typed知识且不重发旧报告。旧缺省policy只兼容P6gargoyle；未知policy拒绝，不配置任意阶段priority或规则布尔拼接。

本卡描述兼容默认；`roles.psychic.inspectionPolicy`现可显式选有限AWA目标/行动策略，见[配置契约](../contracts/role-policy-configuration.md)，未知self/真身份穿透/夜序等参数拒绝。公开六人与十二人用已实现角色的AWA改编（十二人为4普通狼／通灵女巫猎人守卫／4民），机械狼仍planned，不冒充来源完整机械板。角色不写死亡或判胜；DeathResolution与PM保持完整遗言/警徽/技能/追加死亡后最后judge。

## 来源与AWA细则

[组织者通灵师](https://melbournemasters.org/setups/roles/通灵师)与[机械狼通灵师板](https://melbournemasters.org/setups/ji-xie-lang-tong-ling-shi)明确神职、每夜具体角色以及机械未学习时显示机械狼；实际通灵查验在模仿后、机械技能前，登记举手不产生查验。

[狼人杀经典版角色说明（2026-03-04）](https://www.langrensha.net/strategy/spirit.html)确认Good与已学习机械狼的学习身份标签；[经典版流程（2024-09-05）](https://langrensha.net/news/20240905-3.html)同样给出学习后查验、机械技能前的相对流程。经典版自身站点langrensha.net与网易langrensha.com分开归属；机械当夜/次夜和技能/刀夜差异留其自身后续冻结，本卡不统一这些版本。

self/repeat/实际alive、max1、可skip关闭机会、三次非法失败、600优先级、原生命/policy终验、G02转移/旧policy兼容/World重入是AWA明确细则，来源简介不足以证明。网易[镜隐迷踪发布稿（页署2023-10-26）](https://langrensha.com/news/official/20231113/26904_1119726.html)的魔镜禁重复属于另一角色，不套普通通灵。

## 必验

Good/count/参数；合法具体role与Seer camp区别、跨夜repeat历史不回写/self/dead/null/错窗、skip/use/lastUsedDay、无目标/非法失败；两个policy同actor独立时点/validator/目标/Baseline/提示、gift/copy真实身份、完整state转移含关闭及policy防篡改；actor/target原生命、同ref policy更改、取消/gateway撤权和已提交重入；P6Garg/隐狼及梦/魅惑/Guard/药/枪/警长/末边判胜；actual SDK/ACP/混合两语字面整局/Tape（首夜救通灵、次夜repeat或skip、十二人三夜）与20seed每板真实查验/repeat/skip正分支；中英提示/拒绝/终端/记录/前端/纯frame/browser/PNG和三路交叉复查。
