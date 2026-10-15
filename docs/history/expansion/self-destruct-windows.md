# P4 G03：四个自爆窗口与首日结算

本批完成[基础规则卡](../rules/awa-classic-v1.md)的公开窗口执行语义和配置校验；保留默认放逐前窗口。特殊狼自爆效果及其他角色仍按后续阶段交付。

## AWA 明确选择的时点

| window            | 动作阶段 | 时点与适用范围                                                                   |
| ----------------- | -------- | -------------------------------------------------------------------------------- |
| on_pre_election   | Day      | 首日启用警长且无有效初始警长时，报名之前；已有警长、警长关闭或后来日次没有该窗口 |
| on_daybreak       | Day      | 夜间死亡与遗言完成后、选择发言方向前；首日沿用先竞选后公开首夜结果的兼容流程     |
| on_per_speech_gap | Day      | 每个正常发言之后，包括最后一次发言后的间隙；中断后不再请求剩余发言/放逐          |
| on_pre_vote       | Voting   | 放逐票请求之前，保留原默认                                                       |

这是 AWA 的离散窗口改编，不宣称统一赛事规则。每个窗口必须同时在enabledWindows中声明并开启对应hooks；显式空列表关闭。竞选前自爆中断当天，不自动在第二天补选。若想跳过竞选前窗口，可使用初始警长或其它窗口。

## 首日提前自爆

首夜待死亡演员按原兼容流程尚未标死，因此可以参加竞选前窗口。该窗口自爆时，PhaseManager不先判胜或跳过待死亡：公开夜间结果，将待夜死与自爆合并为初批，按演员保留Night/Day的实际死亡阶段；同一演员的死因合并去重，自爆优先禁止遗言。

整个初批先dead，再收合法首夜遗言、警徽、死亡技能和追加波次，最后判胜。即使最后一狼已自爆、最后一个神职待夜死，猎人仍可完成已授权枪；多个死亡或同一演员夜毒+日自爆不会重复钩子/遗言。

## 选择、提交与取消

SelfDestructWindow只并发收集选择并在全部返回后重验身份、Alive组件/生命版本、阶段与工具规则，采纳当前仍有效的最小稳定玩家ID。失效的低编号不会挡住仍有效的高编号；所有选择失效时不自爆。

生产窗口的commit回调由PhaseManager持有：它同步写wolf_self_destruct，并立即进入DeathResolution标死，之后才等待遗言/钩子。没有“窗口先写公共自爆、driver下一微任务才决定是否标死”的缝隙。发生阶段取消/生命周期改变的旧选择不能产生公共事实；已经提交的动作遇到后续错误则按已完成前缀保存原错。

低层SelfDestructWindow移除未使用events构造参数；DayPipeline/VotingPipeline没有commit回调时只返回中断意图，不写公共自爆或死亡。完整入口始终提供PhaseManager回调。错误策略与资源收尾仍由runner拥有，没有添加清理框架。

## 配置与迁移

v2 enabledWindows支持ActionWindow四值，重复、未知值及关闭对应hook仍拒绝。新内部override的[]不再被normalizer删成默认窗口。

显式转换无version旧板子仍保留历史有效语义：旧[]曾回退默认preVote，迁移继续物化该默认并给原warning；旧其它窗口有声明但旧工具规则不执行，迁移明确移除并给新增中英legacy_unsupported_windows_removed_explicitly警告。要启用它们须在v2主动配置。正常加载不接受旧格式、不偷偷迁移。

公开示例[十二人四窗口板子](../../configs.example/boards/twelve_player_windows.json)和[运行配置](../../configs.example/games/twelve_player_windows.json)启用四hook/四window，agent沿运行目录默认选择；没有改用户本地配置或读取认证。

模型阶段提示与blast_phase/blast_window两语说明覆盖所有窗口。DeathResolution可接收初批逐演员deathPhases，内部请求仍只有已有death_phase/death_sources；公开/玩家v2及事件字段未变，旧档原文与原顺序不改，内部Tape保严格source/lock/rules门槛。

## 验证边界

[人工窗口判例](../../backend/tests/engine/phases/self_destruct_windows.test.ts)核对四时点、关闭/错阶段/无竞选跳过、复合首日死亡和末神枪、最小有效ID与跨生命周期/阶段撤销、新override与历史转换。[真实传输计划](../../backend/tests/support/self_destruct_transport_plan.ts)是独立六人两天字面oracle，模型只接收自己的计划与已授权提示；每个窗口都运行中英SDK/ACP整局、逐局Tape、零拒绝/回退与PID回收。

Daybreak第二天可在预言家验完后直接终局：模型没有后续prompt便没收到最新查验事件，传输可见target只有[1]；本人私有记录与引擎历史仍必须完整保存[1,4]。不把“记录已保存”声称成“模型已经获知”。

## P5白狼王扩展与接口

四时点及普通wolf_self_destruct保持；白狼王用独立self_destruct_with_target/WhiteWolfBlast/white_wolf_king_self_destruct。SelfDestructWindow.execute现返typed selection，callback接selection，false无效应拒绝后继续更高候选；pipeline保旧summary actorID并带新selfDestruct意图。首日待夜死白狼王不可吞死施放，接收不提前泄露，PhaseManager提交前静默排除；具体角色及来源/接口见[白狼王卡](../rules/awa-white-wolf-king-v1.md)与[契约](white-wolf-king.md)。
