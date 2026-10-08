# P6：熊接入与契约

第十四项原生角色 `bear`／熊／Bear，采用 [AWA 1.0.0 冻结卡](rules/awa-bear-v1.md) 的**入夜取样、天亮公布**版本。官方动物梦境的天亮存活邻居描述是其它版本，不能混作本版实时重新取样。

## 取样、受众与状态

好人神职，没有原生主动技能／工具／狼队权限，正常公共参与。入夜开始按 Identity.seat 形成存活环，取左右最近存活邻居、环绕、跳过入夜前死人；单邻居只取一次，无邻居为quiet。当夜邻居死亡／身份或座位变化不重新计算，下一夜重新取样。

当前普通狼／狼王／白狼王／狼美人可被感知；[隐狼](hidden-wolf.md)按曾接刀事实：从未接刀不触发、曾接刀可触发，暂时失去当前刀资格不恢复伪装。检测先要求真实 Camp.Wolf，再应用 profile 的独立 `detectableByBear(world,role)` 策略，缺省为可感知；它不借预言家伪装、狼聊或临时刀权状态。

BearNightFrame由PhaseManager在本夜开始持有，包含原World／角色／state／生命引用与版本及待公布bool；不落目标组件、DTO、角色history、操作或录制。第一日竞选／退水／警长投票不能提前拿到样本。全场公告 `bear_roared {day,roared}`，没有熊ID、邻居／方向／数量／身份或死亡原因。只有公开后的 `{day,roared}` 进入本人history／提示／观察，其他人经公共事件获得同一bool。

取样原生命在公告时已死则quiet，包括夜枪／Charm／Dream追加死亡；入夜前已经死亡的原熊也在实际到达的天亮quiet。角色／state／生命组件被替换、复活或阶段撤权使旧帧失效，不晚写新生命／history；无效跨World调用不消费，原World仍能合法发布。相同原state/day重复调用不加公告或history。取消保已提交前缀，不提供隐藏的同夜恢复策略。

## 完整链后的时序

PhaseManager先跑完整夜死、原初批遗言、警徽和死亡技能／追加波次，仍由DeathResolution唯一写Alive；之后发布熊公告，再night_settled判胜。首日警长先竞选时等选举结束、夜死真正结算后才公告；后续方向／发言才见结果。

竞选前早爆把Night+Day合并结算时，完整链后仍公告一次，再day_interrupted判胜；合并波中纯Day白狼带死熊也quiet。不存在的竞选不伪造输入；已经中断的白天不再公告第二次。其它已公告后的Day死亡在下一夜quiet，不修改上一份公告。

真实取消回归发现旧警长选举未接DayPipeline的阶段时钟，撤权后仍继续退水／投票。`SheriffElectionInput.isCurrent?`新增可选回调，旧低层缺省true；正常DayPipeline必须传manager当前scope。并行报名／退水／票的调用前、await后、gateway后、聚合前，以及竞选发言和每次阶段交接都检查，撤权不启动后续请求或授徽；原已提交前缀保留，不改正常选举规则。

## 配置、API与版本

- `RoleProfile.maxCount?`是**原生牌池**组成约束；缺省沿既有多重数，熊为1。v2 parse与直接bootstrap都会读取同一profile限制，后者按整个deck聚合，重复低层条目也不能绕过。非法公共count沿`board_config_invalid_field`安全双语说明；没有为Loader／Repository增加层。
- `RoleProfile.detectableByBear?`是可信引擎的只读感知策略，先真实Wolf再调用；本批不提供用户脚本或新配置值，也不等于未来多熊／转化已经支持。
- `BearNightFrame.capture(world,day,catalog?)`与`publish(world,events,isCurrent)`仅供可信manager；引用和样本不是序列化DTO。PM拥有announcement时点与最后judge，角色只拥有已公告history。
- `bear_roared`是typed公共事件；terminal直播不受private flag隐藏，chat仍只含发言／狼聊。IO／思考日志属于独立operator诊断，见[M21日志矩阵](runtime-display.md#p4-m21sdk--acp-日志开关)。前端timeline／纯frame同文案，公告不改变Alive或徽章。
- 公开schema2／Tape2保留，source／lock／rules／RNG兼容门槛包含新代码；旧指纹不假称可执行。记录原文／名字不翻译，不把事件布尔值改成本地化文字。

`roles.bear`仅{}，取样时点／揭ID／主动技能等参数拒绝。公开[六人](../../configs.example/boards/six_player_bear.json)是一狼／熊女猎／两民，AWA演示配比；[十二人](../../configs.example/boards/twelve_player_bear.json)为4普通狼／熊女猎守／4民且有警长，明确AWA当前组合。来源熊隐狼／白神不冒充当前隐狼／白痴，联合板待隐狼另验；两板均屠边、关闭自爆，早爆为人工／wire明确变体。

```sh
bun run --cwd backend run --configs-dir ../configs.example --game-config-name six_player_bear
bun run --cwd backend run --configs-dir ../configs.example --game-config-name twelve_player_bear
```

## 验收矩阵

[人工core](../../backend/tests/engine/rules/bear.test.ts)覆盖邻接／原样本／死因／完整链／撤权／感知与伪装分离／跨World；数量约束另有公开parse／直接bootstrap判例。13 [字面场景](../../backend/tests/support/bear_scenarios.ts)×SDK／ACP／混合×两语＝78本机真实传输完整局，普通positive／quiet、邻狼夜死仍roar、次夜更新、刀／毒／梦／Charm／夜枪／末王徽、首日早爆、Day死熊次夜quiet、十二人实际竞选／药枪／两夜公告。演员只本人literal计划，正常随机发牌严格匹配预选seed，不拿World或RNG生成决定。

逐轮验证Native Bear真实身份及本人已公开history、首日竞选前所有输入无待公告、匿名公共受众、无额外请求／fallback、实际死亡／原遗言／资源／胜者／终局和全部严格Tape。两个public board各20固定active受限seed须自然结束／0拒绝回退／真roar和quiet正覆盖／全部Tape。前端采用本机合成SDK实跑God档，双语browser／纯frame／实际PNG与三路审查范围见[记录](reviews/p6-bear.md)。

P6隐狼／石像鬼及P7–P10继续；本批不声明外部模型质量或64角色任意组合／22机制／T6／P10发布矩阵完成。
