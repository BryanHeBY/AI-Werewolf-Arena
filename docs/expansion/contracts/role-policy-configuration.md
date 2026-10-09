# 现有角色死亡行动与查验配置契约

复核日期2026-10-09；本契约先冻结有限候选再实施；本次两类配置已贯通，最终全量门禁仍需在新源码完成后执行。范围为已实现角色配置，不要求P8–P10新增角色。

## 兼容默认

预言家统一默认`awa_required_when_legal_v1`：eb4f026真实NightPipeline默认requiresAction=true。省略参数、空对象、显式默认、仅targetPolicy与旧内部config反向序列化必须相同；可跳过只由显式`awa_optional_v1`选择，耗尽目标不制造强制请求。

猎人与狼王原生死亡枪默认`deathActionPolicy=awa_qualified_sources_v1`：非空复合来源全部属于WolfKill/MechanicalKnife/AwakenedHiddenKnife/Exile/Shot/WhiteWolfBlast才可开枪；含Poison或其它源均否决。空来源与未知来源不猜。候选`awa_knife_or_exile_v1`仅允许前三种刀和Exile，仍要求每一复合来源合格；是有限AWA产品策略，与现有较严格刀/放逐版本概念相符，不宣称主流或完整赛事规则。保留现有毒静默事件、空枪消费、临时死亡授权、晚校验及完整追加波次后判胜。只配置原生猎人/狼王；机械/觉醒复制枪和赠予/转移枪保持自身原有资源、激活、死亡失效与合格来源语义，不从持有者板子参数自动继承。

石像鬼、通灵师、魔镜少女配置`inspectionPolicy`，有限值`awa_unique_required_v1`、`awa_repeat_optional_v1`、`awa_unique_optional_v1`直接复用现有三种目标/行动策略。默认分别为unique-required、repeat-optional、unique-optional。角色身份policy(gargoyle/psychic/mirror)与配置策略分离：原生时序、阵营、伪装标签、继承与石像鬼查后刀资格保持各自机制；切换目标/行动策略不能换阶段或身份。均不可自验/查死者；unique按实例整局history，无隐式重置；无目标不发不可能请求。石像鬼合法skip仍结束本夜原生查验流程后才可出刀，非法或撤权不能授刀。

新copy/gift按显式来源初态，transfer保存实例策略与history，不凭持有者config重写。请求构造前后、await、gateway与提交检查策略身份；未知版本fail closed。实例、validator、目标提示、baseline/ObservedBot、双语规则提示、独立player DTO、内部BoardConfig严格schema、JSON录制与实际Tape复现必须同语义。具体role报告仍尊重已有伪装，不新增真身份穿透。

## 验证要求

所有省略/空对象/显式默认/反向转换一致；全部有限值及未知值拒绝。死亡枪逐一/复合/毒/空/未知来源、原生/复制/赠予隔离、授权撤销与晚回复；查验三角色×三策略的repeat/skip/耗尽、身份时序不变、策略撤权、独立实例与transfer。双语提示、严格JSON Tape、实际录制重放和受影响旧机制回归。交付状态由验收矩阵记录，不以schema字段存在代替执行闭环。

定向证据：三角色×三策略×两语实际stage/validator/目标提示/baseline/ObservedBot/DTO，逐项与复合死因/空/未知/毒、策略撤权、复制赠枪隔离和石像鬼查后刀当前策略校验。十二组合（3查验策略×2死亡枪策略×2语言）的完整实际录制和严格Tape复现，通过真实猎人→狼王枪链区分两类死亡策略；相关默认机制回归通过。
