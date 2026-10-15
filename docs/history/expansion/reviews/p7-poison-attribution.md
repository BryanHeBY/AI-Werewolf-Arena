# P7 毒药来源及原生命基础

机械反毒必须知道实际施毒者，旧PoisonMark只合并是否有毒，不能据事件历史猜来源。本笔新增core `NightLifeScope`/`NightPoisonClaim`，合法Witch poison保存原caster和target生命，NightPipeline私有state交Damage；没有注册机械狼或实现反射。

Witch请求前捕原Role-kind/Camp/privateState/ability/state/actor life和活targets，await与gateway后再验；旧回复不写新身体或新资源。已提交毒保事件/瓶数前缀，caster死亡或复活不撤已投毒，target原生命失效则不伤复活新body。每源各一条claim，Damage在仍有效同target生命上合并单一Poison死因。未管理的legacy PoisonMark维持原行为；guard/heal/dream/phase/death owner不移职责。

引用仅本夜runtime，不进入role state、DTO、event、logic输出、summary、Tape；现有公开shape与双语不变，Mechanical精确反射仍待下一功能。Source/lock兼容门槛保持。

A独立13条/tmp probe及仓库13/88覆盖await actor/target/state/ability/clock撤销、gateway后target替换、提交后caster dead/revive、target revive/replace、legacy和实际双Witch源保留，0基础阻断；R核机械卡AWA版本/nextNight/独立模式/反射细则，L/D核refs不可泄露、目录仍17已验/机械planned与图形无变化。

最终type/deps/boundaries均exit0；engine512/8212/38文件、0失败；基础50＋通灵36＋石像36＝122实际本机双语完整局/全部Tape＋两角色80seed/全部重放＋8gift实际专项73/36177/7文件、0失败、exit0，日志`/tmp/awa-p7-poison-{type,deps,boundaries,engine,wire}-final.log`。source未在活跃对局中修改。前端/双语data无代码变化，本笔不重复browser/PNG；机械完整启用笔独立做声明矩阵。完整64/22与P7–P10目标持续，未调用外部模型或读写认证/用户configs。
