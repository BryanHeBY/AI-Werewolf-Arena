# P7 觉醒隐狼规则冻结交叉审查

范围：[AWA Awakened Hidden Wolf 1.0.0](../rules/awa-awakened-hidden-wolf-v1.md#awakened_hidden_wolf)及[实现/提交边界](../awakened-hidden-wolf.md)。纯文档，不注册角色或开配置，21 verified/43 planned保持。

## 来源与范围核验

R/T复核官方2023-10-26正文与BV1z84y1R7Du屏幕帧：54/56额外袭击、69/75一毒无解、94复制守防毒/禁连续目标、119相互不认/无夜聊群刀自爆/其它狼出局才袭击、126当夜Mirror看到模板而技能夜末/第二天用。Root也独立view这些帧；两个插画不被称为完整规则，未取字幕接口，图片/视频仅/tmp不进仓库。

任意夜/合法wait、一局次数、actual900/主动次夜与首夜Hunter枪、库存新初态、normal extra knife可留后夜、组合保护/中立事件都是AWA明确选择，原文不足处不猜成官方明证。R未将个人专栏完整Q&A当primary。六结果/五技能与有限七角色一致，原12镜隐组合必须随完整角色交付。

## 首审发现与修正

- **A：激活时间**。原mimicDay+1不足以处理900前中断；改actualActivationNight+1，Hunter实际900armed，后夜补激活不提前使未ready主动技能行动。
- **A：Mirror资源来源**。G02 copy安装要求目标源实例还存在，冲突于“不继承对象库存”。改由Aw安装新native mirror实例，不要求模板当前能力对象，Aw state只存ID/元数据、无双history；自身转出/撤销/复活/reapply不补发。
- **A：盾毒顺序**。只在最终Damage遮Poison会先触机械反射；明确Aw原毒吸收优先，双盾不触该源反射，反射到原施者Aw盾也吸收/不递归。双盾/多源/保护施者是受控字面专项，不冒机械联合板开放。
- **R/T：中立枪受众**。仅Aw发player_shot而NativeHunter仍发hunter_shot可由type推来源；明确两者玩家协议同type/字段，公开玩家event档stage同death_shot。God合法保原type/真牌，自己的已知角色请求stage不被误算其它玩家授权；后续source反例须检查type/stage旁路。
- **R/T：空目标与时点**。mimic无其它活候选不请求、合法wait闭夜不花，actual900+1/900arm清楚；原life与已付前缀保留，actor第一次真死保护不撤与复活/换owner撤权分开。
- **根代理版本收敛**。Wolf复制once库存可留到后夜，null/skip只关本夜不耗；不套机械首刀夜过期、mode互斥、穿盾、反毒或连守自罚。基础首次可刀时点与额外库存期限独立。

## 最后冻结复查

- **A（review_arch_psychic）**：全部前置空位已闭，existing pipeline可承载无新通用框架。paid guard首次真死可沿Dream既有version策略；原body/role/private owner/skill撤换保旧前缀但不授新body。0残留，支持纯文档提交。
- **R/T（review_rules_psychic）**：卡＋contract最新R0，无中立类型/stage、actual时间、Mirror对象已转出、once期限歧义；7类/原12板承诺与测试要求完整，未证条款仍AWA。支持纯文档提交。
- **L/D（review_rules_gargoyle）**：最新card/contract/登记冻结0阻断；Native/复制枪type、字段及玩家档stage一致，God/本人私有请求边界、双语与昵称人格原文、资源字段白名单和actual900明确。原十二人联合板及六人AWA缩编、全部技能正分支和最终gate承诺完整，支持纯文档提交。

本笔检本地文档引用/稳定锚点及git diff --check，未重复没有源码改动的runtime测试，未读写用户configs/认证或调用外部模型。源码仍只有前21角色；后续必要底座各自功能提交、完整Aw和原12板全部gate、P7黑市商人及P8–P10/64/22/长局/T6目标持续。
