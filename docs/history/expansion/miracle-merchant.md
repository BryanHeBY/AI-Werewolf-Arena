# Miracle Merchant 接入契约

规则以 [AWA 奇迹商人卡](../rules/awa-miracle-merchant-v1.md) 为准。六人例为两狼／奇商预言家女巫／一民，屠城；十二人为狼王＋三狼／预言家女巫守卫奇商／四民，屠边与警长。受支持组合是已冻结的十类角色白名单；与机械有限板及未实现第三方不自动联合。

## 职责与数据

Merchant125 在重置100后、Dream150及所有其它实际角色前；通过 bestow_ability 花一局一次，null等待只关本夜。Good神职、Good胜利，原生不能自爆/刀/枪。真实目标camp在实际提交点分类；Wolf不给能力且只列原Merchant反噬，Wolf目标不知情。非Wolf通过现有G02库存装配一个 activation=lucky、maxUses=1、startsOnDay=当夜的独立实例；幸运技能700提前进入调度表，不靠赠予后重新扫描临时追加阶段。

三个普通原生 collector 排除Lucky；Lucky700只收Lucky，复用相同工具/schema及对应规则，传明确ability_id。普通和幸运库存/历史各自独立。赠予技能不是新底牌，持有者及Agent/persona不变化。工具/阶段/资源ID不本地化，角色/绑定规则/候选目标/错误/观察/终端/时间线与frame两语一致。

NightAbilityScope 保存原role/camp/privateState/ability/state/id/activation/生命与阶段，await/gateway/实际应用再验；普通用药额外复验瓶数。联合目标账本按 World 与稳定玩家ID保存本人当前/前夜已实际操作，且只保需要的两个夜次。不能用全局印记、他人动作或一个实例lastTarget推测目标。校验、提示、观察DTO、模拟策略、实际提交处共享该账本；Actor只有自己的分离副本。

同kind同夜不重复目标，guard还禁本人前夜所有普通与幸运目标。Lucky库存花尽/转出后，旧Actor前夜操作仍约束自己；新Actor按自己的账本。Lucky none须本人ID，毒目标列表单列，不能因该ID不能再次毒而禁止合法none。Lucky使用专属可等待directive，不由use_potion工具名误推强制女巫阶段；普通Witch保留原directive。

实际死亡把Lucky永久deathExpired+disabled，显式enable不能解封，transfer保库存/本夜关闭/政策/完整state及失效；copy来源Lucky被拒，不能改activation普通洗库存。已提交毒/守仍归本夜效果，caster死不退款，目标原生命失效不作用到复活新身体。guardClaims绑定原target生命和marks引用；legacy未经管理的mark仍保持原行为。

Merchant私有状态只有remaining/closedDay/choice(day,targetId,skill)，无success/目标camp/反噬字段。gift:miracle不编码donor编号；sourceDisclosed=false裁事件/DTO来源。商人本人看自己的选择，收者看到赠予库存及绑定规则；God才看到merchant_trade_resolved(granted/backlash)，玩家不能从引擎直接得到这项分类。

反噬使用MerchantBacklash，普通Guard/Heal/机械盾不挡、Dream可挡；挡住不返交易，目标后死/变camp不重分类。阶段不写Alive，Damage只出提案，DeathResolution统一遗言/所有徽章/角色钩子/追加死亡，PM最后judge。首夜反噬有遗言；反噬复合源禁枪。

## 字面完整局

[九类计划](../../backend/tests/support/merchant_scenarios.ts)通过正常seed发牌，演员只读本人计划；不借生产damage/judge生成预期。每类SDK/ACP/混合×中英，共54本地实际完整局及全部严格Tape：

| 场景     | 关键动作与最终字面结果                                                                            |
| -------- | ------------------------------------------------------------------------------------------------- |
| check    | 原生Seer4验1、Lucky验2；同夜重复1先拒后纠正。两夜放逐W1/WK2，WK枪4；Good，活3/5，遗言1/2。        |
| poison   | Witch5原生救6，Lucky毒W1；当日放逐WK2枪4。Good活3/5/6，原生毒仍1、Lucky毒0。                      |
| guard    | Guard5普通守6、Lucky守4；次夜普通再守4先拒后守3，WK刀6，放逐WK枪5。Good活3/4，Gift死亡永久失效。  |
| hold     | V6当夜保幸运验，次夜验WK2；WK刀4，放逐WK枪5。Good活3/6。                                          |
| late     | M3首夜不赠，第二夜赠V6毒；WK刀5与Lucky毒WK2同批，Good夜终局活3/4/6。                              |
| backlash | 给W1无赠，商人首夜反噬遗言3；次夜Witch毒WK2与刀4全死亡后Good夜终局活5/6。                         |
| dream    | 首夜给W1反噬及刀M3都被Dream保护，交易仍花；次夜WK刀6、放逐WK枪Dream5。Good活3/4，无全天梦牵连。   |
| hidden   | 给未接刀伪装Hidden2失败，商人遗言3；W1放逐后Hidden接刀，次夜刀6，放逐Hidden。Good活4/5。          |
| twelve   | Seer5首夜原生验WK1/Lucky验W2、实际竞选；三夜消灭四狼，最后WK枪M8。Good活5/7/10/11/12，遗言4/2/1。 |

核心另外有终局真实反噬＋末狼自刀：两份首夜遗言、商人警徽转给活民后才Good优先封盘；联合历史/ID漂移/resource/原生命/gateway后撤权、隐私与永久死亡/transfer/copy固定回归。两公开板各20受限观察seed，要求自然结束、零意外拒绝/回退、实际赠予/反噬/幸运效果/等待正分支并逐局Tape。

完整门槛、三路发现与修正见 [审查记录](reviews/p7-miracle-merchant.md)。P7 其余四角色、所有已支持阶段矩阵、P8–P10/真实模型与长局仍继续；本功能没有访问用户凭据/配置或外部模型。
