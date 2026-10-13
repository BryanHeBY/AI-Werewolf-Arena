# C31：全板放逐单位与死亡波执行上下文

## 真实单位

VotingPipeline 在 preVote 自爆返回与首 current 门禁之后、第一轮票之前开启一次 ExileUnit。PK 与王子复收票沿用该局部对象；开票后七个返回路径都关联同一单位，零票、平票、翻牌免死及目标映射落空不会误记成没有单位。日次在原 requests／Animal 参数读点捕获，不多读 options.day。

普通板子独立 token；Animal 的单位 ID 直接引用原已发行 token。它的 completedUnits、lastUnitDay、猫 firstUnit／expiresAfterUnit、回合及关闭仍由原 authority 持有。默认跳票不推进计数，因此下一实际单位可复用数字 number，但 token 仍不同；新时钟不维护影子计数。

经理只在两个真实自爆提交后的 skip 位置命名 skipped_day，不从 generic interrupted 推测。骑士结束白天没有放逐单位；其元数据只有原 dayRevision。preVote 中断没有正常开票单位。

## 与死亡波的实际关联

经理全部真实 resolve 入口关联已有 Night／Exile／PhaseRevision：特殊夜与赤月到期、普通夜、Mist 延期、日自爆及混合夜死／日自爆、骑士、投票自爆、Animal 放逐／反击和普通放逐。捕获修订号使用原局部值，不新读取 World、day 或计数器。

DeathWaveUnit 的 execution 是执行上下文，不声称每个目标来自上下文的所有单位。Night／Day 死因仍按原 originPhases 和 nightOrigin 判断；initial、每个 additional proposal、逐枪与 revisit 的原单位／父回执关系保持。新字段通过 own-data 和自有身份读取，旧 getter／Proxy 不多执行；不授权资源或死亡。

骑士原无 nightEffects，新 execution-only envelope 无原型，缺项不会查 Object.prototype 的保护／回调 getter。它保持原资格及回调门禁，不顺带新增 dayIsCurrent 过滤。

## 中文说明与有限验收

六源码／测试路径同步中文职责及重要数据／排序／失败说明。四个原完整程序按准确时钟增量逆迁仍相同，所有旧输入、票矩阵、源字段与序列化事实保持。唯一首证明红是双 options.day 捕获的脚本错误要求单次匹配；改为精确两次，不改生产。

首新增七例 7 通过／28 assertions：真实 PK→Wave、同日两个空票单位、preVote/current 拒绝、Animal 两跳票政策、混合来源及旧元数据。新增无原型决斗包反例单独通过；原三个 PK 例 3 通过／33 assertions。有限类型项目的首测试红仅新 fixture 误用字符串而非 ActionWindow enum，修为同值 OnPreVote；生产源码未改，既有用例不重跑。

固定范围、最终类型终态及交叉审查见 [证据](generated/exile-unit-and-wave-context-evidence.json)。本轮不运行全量游戏、发现、模型或网络，P9 同源验收继续。其它具体能力以日次定义的资源／期限没有在这次命名中重新定义；完整 C31 的机制矩阵仍需阶段汇合验收。
