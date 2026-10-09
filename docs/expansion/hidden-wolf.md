# P6：隐狼接入与契约

第十五项 `hidden_wolf`／隐狼／Hidden Wolf，采用[AWA冻结卡](rules/awa-hidden-wolf-v1.md)的熊隐狼版本。迷雾的互不认识／固定刀顺位／永久角色平民与P7觉醒隐狼分别处理。

## 身份、信息、接刀

真实Camp.Wolf及Wolf胜利归属，原生最多1。单向知道其它Wolf的授权ID、不揭特殊牌型；普通pack不认识隐狼。始终不参加或读取普通狼聊，不原生自爆，只有继承后的基础刀；身份知识不按存活删ID，历史聊／票按发生时固定audience，不因后来接刀补发。

原state `{hasInheritedKnife:boolean}`记录曾获得事实。PM开局装配、DeathResolution实际死亡提交后同步刷新，查询／预检／提示／熊感知均不消费或改变state。只有隐狼活着成为唯一真实Wolf时接刀，自己也在同一初批或同一追加提案死去则不假接。不同已提交提案先死最后其它狼、后杀隐狼，保中间实际获得事实；同提案的数组顺序不决定事实。

actor-only `hidden_wolf_awakened {actorId,day}`一次，无候选／数量／队友名单或原因。当前基础刀还须自身存活、原角色及state有效、当前唯一活Wolf；复活其它Wolf可撤当前资格，却不复位曾获得／伪装解除。Night正常`kill_vote`可弃票／自刀，Day接刀不立刻行动，无原生夜聊／死亡枪／主动查验。

未曾获得：阵营查验Good、具体角色Villager、熊不感知。曾获得：Wolf／Hidden Wolf、熊可感知，死后不复位。具体角色标签是本AWA补充，非迷雾永久平民版。Knight和人数／胜利归属始终用真实Camp，守墓反馈用实际放逐时的冻结查验标签。熊仍按其入夜样本，当夜末狼死亡不会重新计算该夜公告；提示明确“从未接刀”，不把暂时无当前刀权说成恢复伪装。

## 生命周期、死亡与旧前缀

接刀更新不写Alive、不直接判胜。DeathResolution保持整波死亡、原遗言、所有徽章、技能／追加波次，PM最后judge；每个追加提案含梦扩展的实际新死集合处理完才刷新继承，不用逐ID中间态。真实Hunter＋获授Dream的普通狼链已验：同时带走最后普通狼及隐狼不假接。

狼聊／票在await和gateway后再验原Role-kind／Camp／Alive版本／privateState引用和当前权限。聊天提交点独立复验participants，不以旧gateway ok绕过动态撤权。已经合法提交的记录保留。

每张有效非弃票保原目标life/version，最终effect tally仅计仍有效原生命的票；同ID的新生命新票可合法计入，但旧票不混入新票。`WolfKnifeTargetScope`保存选定目标的life/version/marks，仅NightStageState临时使用。每阶段前后及Damage前失效则撤该旧WolfKillMark和当前刀口，保毒／Guard与已接受票前缀。首日NightDamage延后到竞选后，`deathLives`内部map在真正结算前重验，去除失效Root并据实际名单发布NightResolved；Night来源及合并Day爆死沿实际原生命，不把旧伤害搬给新身体。

这些引用不进入角色state／观察／事件／操作或Tape，不是事件溯源或通用资源框架。原演员／目标生命更换与复活注入是unit故障判例，完整wire演员仍只合法工具，不声称故障注入都是模型动作。

## API、序列化与中英

- `wolfTeamPermissions(role,catalog,world?)`／`RoleProfile.wolfTeam(role,world?)`新增可选World供动态当前资格；已有普通狼／旧单参函数兼容，隐狼缺World不授刀权。
- `RoleInitContext.world?`与profile `renderPrompt(role,locale,world?)`第三参数使bootstrap的角色提示跟随本局World；RoleCatalog只捕该局引用，不使用全局当前World或把引用保存到state。
- Native观察仅本人 `ownState.hiddenWolf={hasInheritedKnife,canVoteForKill}`；这描述当前刀权资格，具体行动还受Night／回合allowedTools约束。SDK和ACP共享策略，本人每轮状态更新；已死且无新动作的私有档／CP事实不冒称模型收到。
- `NightStageState.wolfTargetScope?`与成功`NightPipelineResult.deathLives`是内部原生命范围；PM只序列化实际ID／原因，现有summary／schema2／Tape2不保存Map／组件／函数。
- 接刀console private flag控制关系事件直播，chat无此事实；独立IO／思考属于operator诊断，见[M21](runtime-display.md#p4-m21sdk--acp-日志开关)。前端God档的接刀文案不改身份／Alive／警徽，后续真实枪死／放逐独立显示。
- source／lock／rules／RNG严格兼容门槛保持，旧指纹档案不是当前引擎输入；原名字、发言和其它原始文字不翻译。

## 配置及验收范围

`roles.hidden_wolf`接受`campInspection`（默认`awa_inheritance_v1`，具名`netease_2020_good_v1`仅影响阵营查验），maxCount1，公共parse与directbootstrap约束。chat／永久伪装／mist参数拒绝。[六人](../../configs.example/boards/six_player_hidden_wolf.json)为隐狼／普通狼／预言家／熊／两民；[十二人](../../configs.example/boards/twelve_player_hidden_wolf.json)为隐狼＋3普通狼／熊女猎守／4民、有警长。均是当前AWA组合、屠边／关闭自爆；来源白神不冒充白痴，迷雾永久平民／固定顺位仍未支持；石像鬼已另见[契约](gargoyle.md)，两者原生同时在场均要求自己唯一活Wolf，不产生双刀，具体伪装标签有独立能力判例。

```sh
bun run --cwd backend run --configs-dir ../configs.example --game-config-name six_player_hidden_wolf
bun run --cwd backend run --configs-dir ../configs.example --game-config-name twelve_player_hidden_wolf
```

12[字面场景](../../backend/tests/support/hidden_wolf_scenarios.ts)×SDK／ACP／混合×两语＝72本机完整局及全部严格Tape，包含Day／Night／毒接刀、熊次夜更新、masked墓反馈／Knight真camp、王枪接后死、同波不接、开局单隐狼／Guard／自刀、十二人真实竞选及药枪／三夜接刀。演员只本人静态计划与预选正常随机发牌，无World／他人计划／RNG决策权；实际system逐actor核单向队友ID，turn核本人状态，完整私有档核不补旧狼聊／票及once事件。

两个public各20seed受限观察自然终局／0拒绝回退、潜伏／接刀／实际新刀票正覆盖与全部Tape。十二人全active的前80探索均Wolf先赢、无接刀；改用已有四种风格的固定0–19分配，9／14实际接刀出刀，保正断言、没有更换板子或重写机器人让引擎配合测试。核心另验演员／目标life、旧票／后续阶段／首日候选等待、新生命新票、完整链与阶段撤权。前端本机合成SDK实跑God档／browser／实际中英PNG及三路问题闭环见[审查记录](reviews/p6-hidden-wolf.md)。

本角色功能门槛依delivery§3，P6结束完整已支持矩阵仍须回归；P6整阶段与P7–P10／T6／发布长局继续，未将72局当外部模型质量评测。
