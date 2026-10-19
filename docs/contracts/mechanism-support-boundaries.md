# 机制支持与复现边界

## 角色和板子

当前运行Role以`packages/game-contract/src/identity.ts`的封闭枚举及`backend/src/rulesets/roles/builtin-contributions.ts`的实际贡献为准。完整规则及配置变体见[规则 spec](../rules/README.md)，实现入口见[机制索引](../architecture/feature-ownership.md)，角色与公开入口见[支持矩阵](gameplay-support-matrix.md)。资料目录中的规划角色不授予运行支持。

角色可用性受完整板子 schema、profile 的 `supportedBoardRoles`／`supportedWinConditions`／`maxCount`、策略配置及 ruleset 组合共同约束。没有显式角色限制也不代表支持任意混搭。公共发言、投票、获赠能力与原生技能分别判断资格；被动角色没有额外请求不代表免除共同流程。

## 原M01–M22与现行实现

下表保持原扩展目标的22类机制范围，导航到当前物理所有者与可配置入口。表中提及的专属角色，只在对应规则卡已经交付的有限板上可用；单个字段不能开启任意混搭。完整合法值及默认由共享schema、角色贡献和ruleset共同校验。

| 编号 | 机制           | 配置与有限选择                                                  | 当前所有者及验证重点                                                                                      |
| ---- | -------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| M01  | 开局与牌池     | `board.size/roleSetups`、game.seed、盗贼／千面人额外牌          | `rulesets/supported-role-deck.ts`、`features/initial-identity/`；数量、原牌池、稳定ID和发牌流             |
| M02  | 身份公开       | `mechanisms.disclosure.deathRevealPolicy`、各技能实际翻牌       | `engine/death-committer.ts`及各feature；未公开身份不进入玩家DTO，God不作权限过滤                          |
| M03  | 胜负           | `rules.winConditions`及有限板优先级                             | `rulesets/victory/`、`engine/phase-manager.ts`；个人／关系组成员、真实检查点与死亡链完成                  |
| M04  | 狼队信息       | 各具名狼型的互认、夜聊、刀权政策                                | `features/wolf-team/`、角色贡献；三种资格分别查询，获权不自动补全无权历史                                 |
| M05  | 查验           | `roles.seer/gargoyle/psychic/mirror_girl/hidden_wolf`等具名政策 | `features/role-inspection/`及各查验feature；真实阵营与认知标签、重复目标和私有反馈                        |
| M06  | 技能资格与资源 | 各角色空对象／有限政策、首夜／冷却／目标／必选                  | 各feature的authority及`domain/request-lease.ts`；拒绝、迟到、撤权零新付款，已付不退款                     |
| M07  | 能力变化       | 机械狼学习、觉醒隐狼复制、商人赠予、亲传／吞噬等                | `features/night-abilities/`、`death-actions/`和来源feature；实例与原体所有权、独立来源及到期              |
| M08  | 夜间时序       | 具名board固定排序及合法动态能力                                 | `rulesets/night-stage-bindings.ts`、`engine/phases/night-pipeline.ts`；不以回调注册顺序或响应竞速决定规则 |
| M09  | 多人秘密互动   | 狼队、情侣、女巫协助组、典狱长双方                              | 各feature及玩家投影；当时受众、本人选择与God结果分开，协助者不获女巫额外情报                              |
| M10  | 目标变化       | 狼术师座位、魔术师目标、蚀时反弹、诡术师放逐映射                | 对应feature与rulesets有限组合；稳定玩家ID、号码与真实目标分别记录                                         |
| M11  | 伤害与保护     | 普通守救、梦／梦链、盾、交易保护及具名穿透                      | `rulesets/night-damage-composition.ts`、死亡准备及对应feature；死因集合、原body、原提案与实际死亡分离     |
| M12  | 特殊生存       | 白猫延迟、夜仆、秘身、觉醒狼美人替死等具名政策                  | `features/animal-dream/`、`noble-secret-body/`、`awakened-wolf-beauty/`等；不能从日志复活或退款已付替死   |
| M13  | 死亡连锁       | 原生／复制／赠予枪、双爪、巡猎、牵连                            | `engine/death-resolution.ts`及`features/death-actions/`；逐波真实标死、许可、后代链、词徽与最终判胜       |
| M14  | 遗言           | `mechanisms.lastWords.policy`及连续决斗专属延期词               | `features/last-words/`、`engine/duel-last-words.ts`；实际死亡、原体与每份一次授权，失败不补假词           |
| M15  | 自爆与公开行动 | `mechanisms.selfDestruct`窗口、普通／连续决斗                   | `features/self-destruct/`、`knight/`、`awakened-knight/`；声明、已付尝试与实际死讯分开，PM拥有中断意图    |
| M16  | 投票           | `mechanisms.voting`、tieBreaker、乌鸦附加票／王子重投           | `engine/phases/voting-pipeline.ts`与具名ruleset；原票、附加来源、权重、弃票、PK与真实候选分别保留         |
| M17  | 警长与警徽     | `mechanisms.sheriff`选举／徽章政策及票权                        | `features/sheriff/`；警上、退水、PK、方向与原持徽死亡交接，不借提案移徽                                   |
| M18  | 发言与表达     | 正反向、杠精辩论、禁言手势／翻译                                | `engine/phases/day-pipeline.ts`、`features/debater/`、`silence-elder/`；文字版改编具名，拒译与未提交分开  |
| M19  | 人格与关系     | game.players／roles、昵称／customInstructions、关系选择         | `app/config/resolve-game-setup.ts`及关系feature；Agent独立选择、指令逐层追加／替换／清除与原文保留        |
| M20  | 事件与道具     | 唯一已交付`awa_wall_notes_once_v1`／`anonymous_note`            | `features/wall-notes/`；一次私有短句、随机匿名公开；不是可执行脚本或任意道具系统                          |
| M21  | Agent运行      | Provider／Agent与席位绑定、并发／超时／取消／日志               | `agents/`、`adapters/`、`app/game-runner.ts`；统一接收器，独立会话与清理，裸cwd不算沙箱                   |
| M22  | 记录与审计     | 稳定事实、locale、私有Tape、公开God与逐玩家导出                 | `recording/`、`app/simulation/`及公共replay包；格式、独立审计与同构建执行三层分别验收                     |

验收使用人工规则反例、具名板完整局、受限观察、真实本地SDK／ACP／MCP及双语帧；覆盖机制种类不等于穷尽所有交互。公开板批次按[验证方法](../guides/validation.md)执行并保留对应构建的实际结果。

## 数据与运行权限

- 容器、clone、格式和显示不拥有动作许可或资源付款。运行授权来自具体资源所有者，不从 JSON 或相同字段重建。
- World、原组件、生命版本、能力实例和证明保留在实际所有者；公开扩展只消费明确查询及具体命令。
- 工具规则、夜间阶段、死亡钩子、角色贡献及胜负评估的可替换回调不能因编号或函数同名取得内建的私有输入。
- 角色初始化只保留其自有容器和声明的初始写权；公开 `stateData` 是脱离原对象的受限副本，不授予组件访问权。
- 名称展示由 `packages/game-text/src/role-names.ts` 唯一拥有，稳定角色 ID 与翻译文案分别维护。

## 三层复现保证

| 层           | 实际入口                                            | 保证与限制                                                                           |
| ------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 格式与身份   | `backend/src/recording/reproduction/format.ts`      | 检查结构、版本和来源关系，不证明游戏状态或资源已付款                                 |
| 独立机制审计 | `backend/src/recording/verification/assembly.ts`    | 按档案字段核对账本、因果和部分失败前缀，不执行生产规则或重建运行许可                 |
| 精确执行     | `backend/src/app/simulation/replay-reproduction.ts` | 在受支持的构建、随机、规则和输入身份下实际重放并比较，不承诺任意外部闭包或跨构建执行 |

独立审计按以下顺序装配，RedMoon 由 Demon 校验器内部核对：

| 序  | 实际函数                          | 物理owner                                                            |
| --- | --------------------------------- | -------------------------------------------------------------------- |
| 1   | `validateInitialIdentityRecord`   | `backend/src/recording/verification/initial-identity/validate.ts`    |
| 2   | `validateWildChildRecord`         | `backend/src/recording/verification/wild-child/validate.ts`          |
| 3   | `validateLonelyGirlRecord`        | `backend/src/recording/verification/lonely-girl/validate.ts`         |
| 4   | `validateGhostBrideRecord`        | `backend/src/recording/verification/ghost-bride/validate.ts`         |
| 5   | `validateAnimalDreamRecord`       | `backend/src/recording/verification/animal-dream/validate.ts`        |
| 6   | `validateFragrantPairRecord`      | `backend/src/recording/verification/fragrant-pair-seer/validate.ts`  |
| 7   | `validateNobleSecretBodyRecord`   | `backend/src/recording/verification/noble-secret-body/validate.ts`   |
| 8   | `validateDemonHunterRecord`       | `backend/src/recording/verification/demon-hunter/validate.ts`        |
| 9   | `validateScholarMentorRecord`     | `backend/src/recording/verification/scholar-mentor/validate.ts`      |
| 10  | `validateMistRavenRecord`         | `backend/src/recording/verification/mist-raven/validate.ts`          |
| 11  | `validateRadiantEclipseRecord`    | `backend/src/recording/verification/radiant-eclipse/validate.ts`     |
| 12  | `validateTimeConsortRecord`       | `backend/src/recording/verification/time-wolf-consort/validate.ts`   |
| 13  | `validateWolfSorcererRecord`      | `backend/src/recording/verification/wolf-sorcerer/validate.ts`       |
| 14  | `validateTricksterRecord`         | `backend/src/recording/verification/trickster/validate.ts`           |
| 15  | `validateMagicianRecord`          | `backend/src/recording/verification/magician/validate.ts`            |
| 16  | `validateOrderPrinceRecord`       | `backend/src/recording/verification/order-prince/validate.ts`        |
| 17  | `validateCupidRecord`             | `backend/src/recording/verification/cupid/validate.ts`               |
| 18  | `validateHybridRecord`            | `backend/src/recording/verification/hybrid/validate.ts`              |
| 19  | `validateDeathHistoryRecord`      | `backend/src/recording/verification/death-history/validate.ts`       |
| 20  | `validateCrowRecord`              | `backend/src/recording/verification/crow/validate.ts`                |
| 21  | `validateSilenceElderRecord`      | `backend/src/recording/verification/silence-elder/validate.ts`       |
| 22  | `validateAwakenedClawRecord`      | `backend/src/recording/verification/awakened-wolf-king/validate.ts`  |
| 23  | `validateAwakenedWitchRecord`     | `backend/src/recording/verification/awakened-witch/validate.ts`      |
| 24  | `validateWardenRecord`            | `backend/src/recording/verification/warden/validate.ts`              |
| 25  | `validateAwakenedDayRolesRecord`  | `backend/src/recording/verification/awakened-day-roles/validate.ts`  |
| 26  | `validateAwakenedDarkStarsRecord` | `backend/src/recording/verification/awakened-dark-stars/validate.ts` |

没有专属校验器的机制仍受共同格式、身份及实际执行检查约束；专属校验器的数量不表示全部角色规则都已独立覆盖。普通死亡历史审计不能提供完整生命引用证明。

## 候选、完成与失败前缀

| 实际路径                     | Tape里可说的事实                                                                                                      | 领域证据与限制                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 未登记completion             | Provider返回了action/null候选；不是accepted/paid                                                                      | 后续真实stage/commit仍需核CP、facts、ops和原体/库存；无helper不自动构成漏事务                                               |
| 历史严格Tape2的deferred协议  | true/false由真实窗口完成点给出；false将outcome记error且不保存返回候选                                                 | 历史2保持严格原shape，不回填候选；partial保实际CP前缀，false不是rollback                                                    |
| 当前严格Tape3的deferred协议  | 仅实际settle(false)保存此前安全复制且正常返回的returnedCandidate（ToolCall或自身显式null）；outcome仍error            | false原因可为无效输入、期限／当前性或partial；字段不证明accepted/paid或失败原因，true与真实Provider/copy/交付早抛不产生字段 |
| `RecordedActions`读error     | 当前Tape3仅有自身候选时重交原候选；旧2或缺字段仍在Provider点抛归档error                                               | 重交候选不等接受／付款，不保证重新制造任意外部安装、期限或通知失败的领域prefix                                              |
| 独立validator读error/pending | Cupid／Hybrid先读取action或error+自身候选，已知null／无效工具／冲突目标不能借CP/facts或早候选绕过；缺字段才是末opaque | 候选只约束回复事实；合法partial与库存/组件/事实写序另审。其他validator仍按各自原合同，不外推任意错误重现                    |

窗口完成点由具体机制定义。遗言没有库存，墙报的合法空回复或已处理拒绝也可能正常完成；涉及资源的窗口仍独立核对付款。部分失败保留已经发生的状态和记录前缀，不统一回滚或二次结算。

流光／蚀日的原始非法候选可能由领域执行消费后失败，Tape 仍记录为 action；不能统一提前改成 Provider error，否则会改变操作和 checkpoint 前缀。Cupid／Hybrid 对明确记录的 null、错工具或冲突目标保持独立拒绝，不能用 checkpoint 或早先候选覆盖已知选择。没有记录候选的末 error／pending 仅在各校验器声明的范围内接受不完整 checkpoint。

Tape3 仅在自身明确保存返回候选时重交原值；旧 Tape2 或字段缺席仍保留 Provider 异常语义。候选不证明接受、付款或失败原因，也不保证任意期限、通知或外部组件修改能够无损复现。版本配对和来源检查见[归档兼容](archive-compatibility.md)。

## 显式外部故障

只有已声明、具名和版本化的 `metadata.faultPlan` 输入享有对应故障重放保证；未记录的测试闭包不具备该保证。贵族的受控生命替换使用相同故障执行所有者，并记录必需因果操作，范围见[录制契约](recording-and-reproduction.md#显式故障因果)。

## 公共 API

跨模块使用当前 package exports 和具名公共端口，不承诺旧物理深路径、未知动态导入或任意 JavaScript／Proxy 观察兼容。代码文件、注释和导出调整可能改变源码指纹；不得回写历史归档身份来掩盖不兼容。

## 典狱长有限组合

[典狱长规则](../rules/awa-melbourne-warden-v1.md)只开放三普狼＋典狱长＋四民＋预女猎梦原十二人板，见[完整示例](../examples/warden/README.md)。运行 `features/warden` 拥有唯一不可变历史、每人一次参与资格、pair／独立decide窗口及已付原体效果；`rulesets/warden-native-target-validation.ts` 仅为原生个人技能增加partner限制，不更改团队刀票。

夜伤将保护与 `Deal` 分开：交易保护晚查原体及已付predicate，仅免普通刀／毒／梦；Deal保留独立死因且纯Deal不授枪。摄梦Frame复用其既有夜源连锁保护端口，不把交易保护加入Shot免疫。`recording/verification/warden/validate.ts` 在实际assembly登记，独立验一次参与、秘密受众、四格表、原生目标与按真实settleOrder的完整／失败CP；它不读取生产窗口作oracle。God archive含完整决定，玩家导出逐人只含自己的pair或通知／决定。

## 觉醒狼王有限组合

[双爪与亲传规则](../rules/awa-awakened-wolf-king-v1.md)开放原十／十二人牌池及显式女巫自救／十二人梦保护；觉醒女巫另有下节精确原十二人组合。[完整示例](../examples/awakened-wolf-king/README.md)给出对应公开入口，觉醒女巫合板不继承原十二人梦保护，按下节独立闭包验证。

`features/awakened-wolf-king/` 持唯一原生／受传库存和亲传夜窗，普通狼受传不改变原身份、不建立赠枪镜像。`engine/hooks/death-action-continuation.ts` 只持一次不透明继续程序；DeathResolution 在首枪真实死亡及全部后代／词徽完成后执行下一爪，独占真实死亡波与继续点，PhaseManager保留阶段推进和最终判胜。付款末端只读真实 ECS 同步核两端原体，不调用可重入的 World 查询或执行未知范围 getter。

`recording/verification/awakened-wolf-king/validate.ts` 只读档案独立重建单位／转出／消费／失效，严格核私有受众、开窗日次、真实夜伤与梦保护、完整后代顺序及精确已知候选的失败CP。它不导入生产库存、死亡写者或恢复许可。两个原板分别以两语各20seed完成受限自然局／严格重放，双爪／亲传的LLM、ACP、mixed完整传输及第二枪missing／late独立反例不外推为其它混搭支持。

## 觉醒女巫有限组合

[三次秘密调毒规则](../rules/awa-awakened-witch-v1.md)只开放三普狼＋觉醒狼王＋四民＋预言家／守卫／猎人／觉醒女巫原十二人板。[公开入口与两语God教学档](../examples/awakened-witch/README.md)只要求复制board与game，个人runtime不覆盖。`roles.awakened_witch`严格为空对象，不暴露无来源的任意瓶数／协助／自救开关。

`features/awakened-witch/`拥有唯一历史和原体窗口；发起、每次讨论、每张批准与最终Poison提案分别首写。发起先消耗次数和参与资格，否决不退款；全票已付但finalize失败时仍可为building失败前缀。最终typed Heal／Poison交原伤害所有者，普通Guard不挡毒，刀毒混合禁因优先；原生Hunter与狼爪后代仍按完整链结算。

独立`verification/awakened-witch/`只从请求／事实／游标／God检查点重建资源与隐票矩阵，不导入生产authority或伤害writer。女巫只看本人已付选择，协助者只看本组交流与自己票，最终结果仅God。40两语受限自然局逐份strict、六正常及十二失败真实SDK／ACP／mixed、多人一late保另一付款与Web帧证据见规则卡，不外推为其它混板或付费模型验收。

## 原十／十二人暗夜星辰

[觉醒狼美人](../rules/awa-awakened-wolf-beauty-v1.md)与[觉醒猎人](../rules/awa-awakened-hunter-v1.md)仅按已核实原两板共同开放，入口与两语 God 档见[暗夜星辰示例](../examples/awakened-dark-stars/README.md)。普通女巫／守卫保持各自原政策；其它保护、骑士、复制、换体或复活不因同名字段自动支持。

两族分别拥有唯一选择／付款库存、原生命窗口和具名窄端口。`rulesets/awakened-death-prevention.ts`组合具体提案准备，不拥有Alive或阶段；真实标死、词／徽、追加波和完整链后判胜仍归引擎。原夜伤操作保最初刀毒提案，God替死付款桥接到实际 `night_resolved`／`additional_deaths`，公开结果不替代物理死亡。`verification/awakened-dark-stars/`独立核资源、原提案、根、方向与私密序列，不导入生产authority；失败CP只容纳当时已知候选／原提案可证的精确首写，不回滚已发表付款或借未来游标解释旧库存。

## 原觉醒骑士十二人联合板

[觉醒守卫](../rules/awa-awakened-guard-v1.md)、[觉醒骑士](../rules/awa-awakened-knight-v1.md)与[觉醒狼美人](../rules/awa-awakened-wolf-beauty-v1.md)共同开放 `awa_netease_awakened_knight_12_v1`：三普通狼、觉醒狼美人、四平民、预言家、普通女巫、觉醒守卫和觉醒骑士。入口、三份中英LLM／ACP game和六份真实God教学档见[完整示例](../examples/awakened-knight/README.md)。本板没有觉醒猎人、梦保护、复制、赠予或复活，不与暗夜星辰任意拼接。

三个角色配置 `roles.awakened_guard`、`roles.awakened_knight`、`roles.awakened_wolf_beauty` 都严格为 `{}`，分别采用 `awa_awakened_guard_cycle_v1`、`awa_awakened_duel_chain_v1`、`awa_awakened_replacement_v1`。`features/awakened-guard/`唯一拥有实际夜＋日周期历史及已付原目标盾，`features/awakened-knight/`唯一拥有稳定目标的全局尝试历史；有效JSON不能重建运行许可或回滚库存。N1无请求准备阶段绑定原体，首个白天不能重新捕获新生命继承资格。

`rulesets/awakened-day-role-plan.ts`只在普通放逐讨论开始、已完成公开发言／技能之后、PK发言边界及真正开票前的有限窗口，固定先守卫再骑士；每次成功决斗的完整真实死亡链返回后，下一次连续决斗之前也先守卫。实际PK保持 `Voting`，不改写为 `Day`；同一边界不重问，不抢占正在生成的发言、警上、票中、遗言或死亡动作。wait仅保留到本周期下一个实际边界，不能预知的未来PK／续步不冒充最后机会；真实周期owner在日终关闭仍open的历史及盾。普通决斗窗口的null仅为本边界不发动，成功连续窗口的null才是结束本链并请求入夜；缺失／迟到不当作主动选择。

`rulesets/awakened-death-prevention.ts`在真实生命提交前组合全天盾→未阻挡才支付狼美人替死→替身再判盾；组合不直接写Alive。已付盾独立于施者后续身份／私库，仍只绑定原目标生命。`engine/death-resolution.ts`持真实死亡波、警徽／死亡钩子和 `engine/duel-last-words.ts` 的延期词许可，具名day plan只输出 `resumeDay/nextNight`，PM在完整链与词完成后于既有检查点判胜、推进阶段或恢复冻结发言／PK游标。正中被盾或替死不退款目标尝试；误中两人独立结算，即使骑士保活也停止本链并恢复原游标。异常保真实资源、死亡和未完成词前缀，不补正常链尾、入夜或回滚。

本板普通狼自爆的接受声明与真实 `awakened_self_destruct_resolved` 分开：盾能挡死但合法自爆仍结束当日；保活者后续日按既有资格行动，不新增整局一次库存。未结首夜伤与自爆可由同一次DR实际提交，夜报只列Night根的真实死者，自爆结果另列实际自爆者，空结果也必须发表；提案、声明或付款都不能提前把AI／Web／视频画死。

夜间保护选择只给本人，白天非空保护另公开守卫与目标；具体阻挡原因、替死付款及到期明细只给God。`recording/verification/awakened-day-roles/validate.ts`独立核三族资源、真实动作／窗口、夜伤来源、逐目标根与两份公开桥、延期词、历史feed和完整／失败CP，不导入生产库存或恢复许可。受限自然局逐份strict、实际SDK／ACP／mixed及缺失迟到、自爆有无盾和两语Web倒看证据见[联合规则与回归边界](../rules/awa-awakened-knight-v1.md#示例与回归边界)，不外推真实模型效果或其它混板。
