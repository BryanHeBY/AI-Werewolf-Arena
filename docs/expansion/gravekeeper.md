# P5：守墓人接入与契约

第十一项原生角色 `gravekeeper`／守墓人／Gravekeeper，依据与AWA细则见[冻结卡](rules/awa-gravekeeper-v1.md)。好人神职，自动获得上一日实际放逐的阵营标签；没有原生夜间动作、选目标或确认工具，不把被动通知伪装为模型行动。

## 信息与时序

VotingPipeline确认放逐主目标确实removed后，PhaseManager在中央死亡链之前冻结 `ExileFeedback {exileDay,targetId,result:{kind:"camp",camp}}`。使用共享查验标签而不是具体牌/获胜归属，伪装按profile标签；后续目标camp变化不能倒改结果。

PhaseManager唯一持有待反馈事实，只作为内部NightPipeline输入；普通玩家、守墓人的提示/DTO和公共RuntimeSnapshot均无pending fact。守墓人角色状态只有已交付 `gravekeeper.history`，受限观察 `ownState.gravekeeper`提供合法camp-only报告副本。

原生夜间stage priority550，位于Witch500之后、Seer600之前；从第二夜开始，只有前一日实际放逐的主目标才反馈。白痴免死、弃票无目标、自爆、骑士决斗、枪击和其它追加死亡不算；无放逐不重复旧反馈，旧已知历史保留。多人各获一次，同夜重入去重；死者/已变为其它角色者不再收新结果。当夜未结算刀/毒不提前禁止仍alive的守墓人。

`gravekeeper_reported {actorId,targetId,exileDay,receivedDay,result}`仅actor可见，其他玩家连续可见seq不泄漏数量。上帝档案保完整反馈，该事件的终端直播行只有printPrivateEvents启用才显示；chat摘要不公开。operator另启printLlmIo/printThinking时仍可能看到本人prompt/思考中的已知结果，独立语义见[日志矩阵](runtime-display.md#p4-m21sdk--acp-日志开关)，不改变既有诊断flags行为。前端上帝复盘可以展示此信息，反馈事件不改变存活或徽章。

## 严格协议与取消

共用replay-contract的 `readGravekeeperReport`（四字段history）/`readGravekeeperFeedback`（加actorId的event）要求精确own-data字段、合法正安全ID、相邻放逐/接收日和camp-only结果；拒绝getter、非枚举、未知camp、role/combined、坏日期/多余字段。输出副本，坏历史/外部事件显示Unknown，不猜Good或具体牌；DTO只向策略提供合法已交付事实，原记录仍保原数据。

PhaseManager提供本夜day/phase/gameOver/phaseRevision有效性。手动跳转（包括同phase或离开再恢复Night）撤销旧流程；NightPipeline在stage前后检查，原生行动在await后/gateway后检查，被动反馈提交前检查。中断不再结夜间伤害、生成后续反馈/行动或覆盖手动跳转。已经在有效时提交的前缀保留，错误仍按原路径抛出，不做隐藏回滚/通用清理框架。

额外授权的Seer等夜间能力仍独立调度/消费，不被原生被动技能取消；原生提示明确“无原生主动夜间工具”。本批的giftSeer判例验证独立历史与限次资源，不宣称未实现的商人等角色已支持。

## 程序接口迁移

- `NightPipeline.execute(config,provider,day,options?)`第四参数为 `{previousExile?,isCurrent?}`，旧三参数调用继续可用、默认为无放逐事实及持续有效。低层有待反馈事实/取消边界时须明确传入。
- 返回新增 `interrupted` 判别联合；先检查为false，才读取summary/damage。中断只返回 `{interrupted:true}`，不制造空伤害或假结算。正常PhaseManager提供clock并处理此短路。
- 手工构造 `NightStageContext` 要补必填 `previousExile:fact|null` 和 `isCurrent()`；不能继续用缺失clock的对象驱动新handler。
- `captureExileFeedback`是可信引擎helper，只在已确定主目标实际放逐时调用，不是模型/外部工具的授权接口；内部输入不能从玩家请求拼装。

公开/私有schema2和Tape2保留。Role闭合枚举、领域事件及原生profile登记更新；没有新增ActionStage或tool，反馈stage仅用于事件展示。source/lock/rules/RNG严格兼容继续覆盖新源码/共享reader，老Tape不会绕过版本检查。

## 配置与验收

`roles.gravekeeper`只接受 `{}`，无未声明主动/重复/具体牌开关。公开[六人](../../configs.example/boards/six_player_gravekeeper.json)为2狼/守墓人/预言家/2民；[十二人](../../configs.example/boards/twelve_player_gravekeeper.json)为4普通狼/预女猎守墓/4民。有界示例均屠边、关闭自爆，十二人有警长；独立判例另启自爆/屠城等明确变体。此为AWA已验普通狼示例，来源石像鬼组合待P6，不能据名字先行启用。

```sh
bun run --cwd backend run --configs-dir ../configs.example --game-config-name six_player_gravekeeper
bun run --cwd backend run --configs-dir ../configs.example --game-config-name twelve_player_gravekeeper
```

[人工判例](../../backend/tests/engine/rules/gravekeeper.test.ts)覆盖冻结/伪装/第三方标签边界、时序、多个守墓人/生命/角色、初始无pending、终局、Idiot/无放逐、待刀/毒、Knight/白狼公共杀人、取消/恢复、畸形数据、gift与私有DTO。模型接入[字面计划](../../backend/tests/support/gravekeeper_scenarios.ts)有8case：六人两反馈、白痴、无先前放逐自爆、旧反馈后再自爆、狼王→猎人追加死亡、守墓人被放逐、次夜死亡、十二人警长/药枪/两反馈。每case SDK/ACP/混合×两语＝48实际本机完整局，核对字面角色/请求/私有提示/结果/名单/事件/全部Tape；实际ACP/MCP进程收尾验证ESRCH。

**被动事实已授权记录不等于模型已经收到。** `keeper_night_killed`在Night2被动写history/event后死亡，没有次日模型请求，只有私人档/CP/Tape证据；不能把它当wire提示正例。正常六人/十二人的Day2/Day3及stale/Idiot等本人提示用逐turn字面最新反馈/无反馈标记验证SDK和ACP，他人使用私有事件/文本负断言。

每公开板子20固定seed受限观察模拟，要求自然终局、零拒绝/回退、反馈分支正覆盖并逐局严格重放；决策只本人DTO与具名RNG。共享终端与前端严格标签、实际Chromium、真实十二人SDK档案及Remotion中英帧由[审查记录](reviews/p5-gravekeeper.md)列明最终门槛。未改用户configs/认证，不把本地合成模型当外部模型质量评测。
