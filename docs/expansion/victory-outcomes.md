# P4 G04：胜利结果与归属

## 本子批范围

独立VictoryComponent、阵营/个人/关系组与多人结果类型、条件检查点、一次封盘及结果隔离、内部Tape v2。当前基础引擎只自动执行三个已有阵营条件；个人/关系组通过已解析的规则规格与显式membership表达，人工注入场景证明引擎通路，不代表咒狐/丘比特等计划角色已实现。

G04记录主档/公开reader/前端/终端/视频呈现及完整阶段门槛仍接续下一子批。此处不把目前公开result中的winner=null当作新个人胜利的最终展示交付。

## 胜利归属与人数统计

VictoryComponent.affiliations独立于Role身份、Role.camp、能力与存活。原生初始化默认真实阵营，RoleProfile可用initialVictoryAffiliations声明其它初始目标；安装脱离模板。改变身份/阵营或复制技能不会静默改写胜利归属，角色机制必须明确更新对应component。

- faction：参加指定阵营胜利，winningPlayerIds包括已出局成员。胜利不是“仅存活玩家获胜”。
- individual：个人goalId归属，胜利target另含稳定playerId，只有该人的声明匹配才能获胜。
- relationship：声明groupId归属，获胜集合来自该组的明确membership，身份/阵营无需相同。
- 显式[]表示暂无任何胜利归属（不回退camp），安装和Tape采用同一严格reader；非法机器ID/重复声明在安装时拒绝，不拖到强制落盘失败。
- 同一人可有多项归属；多claim的获胜玩家并集排序去重，各claim保持独立成员。

三个已有条件的存活人数只按真实Role.camp统计，屠边神/民只统计实际Good阵营且profile有对应goodSide者；第三方神职不能误当好人神。成员归属不影响统计、狼队权限或技能。无胜利组件不从角色/阵营猜测成员。

## 结果与判定点

共享game-catalog只定义语言中立DTO；引擎结果含winner/reason兼容投影，以及必须的outcome和decidedAt。

```text
outcome.kind = victory | no_winner
victory.primary = faction | individual | relationship claim
victory.additional = 额外获胜claim
claim.winningPlayerIds = 本claim的明确成员
victory.winningPlayerIds = 全部claim并集

decidedAt = { day, phase, checkpoint }
checkpoint = night_settled | day_interrupted | exile_settled | max_days_reached
```

低层WinConditionSpec/Evaluator/ConditionRegistry从仅{winner,reason}迁移为带outcome的WinDecision；程序化GameResult/game_over构造必须提供outcome与decidedAt。旧注入条件需同步更新，不能靠可选字段维持不明确的新执行。getSnapshot/getEvents现在返回深副本；它们不再提供原内部对象引用，狼队audience在副本中仍冻结。

WinDecision是不含判定点的候选结果；PhaseManager在实际检查点封盘为GameResult。winner仅当primary为faction时投影为阵营，否则null；null也可能是个人/关系组胜利，必须读outcome.kind。

WinConditionSpec可限制checkpoints；缺失或不匹配时不调用该goal。条件列表仍按板子顺序，第一命中结果优先。额外获胜目标由该规则明确提供，不自动把其它命中条件全部叠加。基础同时全狼/全好出局仍优先Good，死亡链全部完成才检查。

Night结算后的action phase为Day；提前/正常自爆为day_interrupted（实际Day或Voting），放逐后为exile_settled/Voting。达到天数限制为no_winner/max_days_reached/Night。封盘幂等，maxDays也产生恰好一条game_over；之后不再请求模型。

## 复制与验证

候选结果由严格共享reader验证，封盘前再由当前明确membership重建核对，不能由定制条件伪造获胜成员；字段闭合、类型/机器ID、排序去重、claim identity、并集、存在的playerId和point组合都检查。owner data快照拒绝继承字段/访问器，不执行未知getter。结果/state/event/公开getSnapshot/getEvents返回独立副本，外部改数组不能改实际封盘。

成员数据是引擎机制状态，当前不加入PlayerObservation或提示；终局claim为公开获胜事实。角色规则后续决定目标关系哪些部分告知本人，不借membership泄露榜样的隐藏阵营。

## 录制兼容

内部reproduction.schemaVersion从1升为2：玩家检查点必含victory.affiliations，终局snapshot必含outcome/decidedAt。严格schema、winner投影/存在成员/point约束及source/lock/rules门槛保留（source包含实际执行的replay-contract共享解析器）。旧内部v1拒绝版本，不自动从历史camp构造胜利归属。

公开复盘和玩家档保持v2；game_over及终局phase_changed领域payload新增结果机器字段，接续[公开结果与双语展示](victory-record-display.md)已将封盘记录到manifest.game_result和public result.decision。旧公开文件的未知与原文政策仍保持，内部schema升级不等同公开schema升级。

## 人工证据

[victory_outcomes](../../backend/tests/engine/rules/victory_outcomes.test.ts)两语覆盖阵营名单含dead、条件优先级/全死、真实阵营与归属分离、第三方god计数、独立个人/关系/额外多人并集、实际PhaseManager checkpoint/封盘、maxDays、getter/坏DTO及模板/结果隔离。个人/组案例是合成注入规格，不使用全知决策bot来声称新角色完成。
