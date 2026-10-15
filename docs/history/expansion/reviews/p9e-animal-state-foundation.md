# P9e 动物梦境纯状态与有限资格底座

依据[冻结规则](../../rules/awa-animal-dream-twelve-v1.md)及[三路预审](p9e-animal-rule-freeze.md)，迁入Fox／Puffer一次资源、WhiteCat延期时钟及四份内部规范形状。未注册Role enum、Profile、Board schema、事件或工具；公开配置仍拒未实现角色，正式52/64和三角色planned不变。

## 职责与实际范围

- game-text拥有唯一policy、有限政策列表／类型及pure isAnimalDreamPreset，检查精确牌池、数量、固定规则和两项政策四组合；这是规范形状判断，不是角色运行许可。
- backend animal_dream/state拥有严格own-data reader、无alias的纯更新。Fox从N2开始，null不耗、非null一次付费；Puffer合法false留库存、true一次付款，主动与未来刀死被动独立。状态历史可跨60夜，不人为在第61次合法空过失败。
- WhiteCat首次延期记录历史来源及最早单位，后续伤害不刷新；当前普通单位首次延期等下单位，同日skip例外只能命中首次占用的同一unit。延期函数不写Alive，也不根据阶段标签签发单位。
- 输出是detached可变数据，不能当Object.freeze权限或原生命凭据。原World／Role／Camp／Alive、原票全集、真实issued unit／kind／phase及deadline由下一owner证明；Puffer调用者须提供授权全集，纯函数只验形状。Animal状态没有接入玩家DTO或动态提示。

## 原意见与复核

R原三类反例已修：刀死日须严格晚于Puffer所有主动/pass历史；Cat不能用旧号unit提前到期；raw sources／unit先做own-descriptor快照，禁止iterator/getter执行。原维护26项／54断言全绿，含81次空过与四份形状、未知／额外字段、数量和旧Bear策略拒绝。

A独立8项／29断言全绿，验证嵌套Proxy零trap、Puffer sparse／iterator／getter输入、来源与层层history无alias、双reader／transition单位下界和一次付费。shared browser copyEventData不冒Node Proxy保障；Node资源reader另用原有snapshotPlainData。T/L/D确认没有内部时钟／刀死日流入玩家，没有开放配置或改旧Bear，并精修“调用者全集”与“冻结候选形状”的注释。

实际日志：`/tmp/awa-animal-foundation-maint-second.log`、`/tmp/awa-animal-foundation-a-review.log`、`/tmp/awa-animal-foundation-r-test.log`；三路报告 `/tmp/awa-animal-foundation-{a-review,r-review,delivery-review}.md`。首次测试类型检查发现闭包中union窄化丢失，改捕获已窄化deferred局部值，未弱化断言；原类型失败留档。随后root check含后端源码／测试与前端均退出0，backend lint／边界／i18n退出0，格式／diff通过。

本切片仅纯基础门禁，没有重跑全支持矩阵或实际游戏／传输／Tape。立即继续共用原玩家scope、原生owner与请求、Fox整队许可／Bear取样、Cat真延期／单位、Puffer原票与死亡链、独立知识／录制及全部交付，完整验收后再改变角色状态。
