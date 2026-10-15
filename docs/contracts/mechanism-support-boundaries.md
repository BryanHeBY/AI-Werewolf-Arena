# 机制支持与复现边界

## 角色和板子

当前支持 55 个运行 Role，稳定 ID 位于 `packages/game-contract/src/identity.ts`，实际贡献装配位于 `backend/src/rulesets/roles/builtin-contributions.ts`。完整规则及配置变体见[规则 spec](../rules/README.md)，实现入口见[机制索引](../architecture/feature-ownership.md)。资料目录中的规划角色不授予运行支持。

角色可用性受完整板子 schema、profile 的 `supportedBoardRoles`／`supportedWinConditions`／`maxCount`、策略配置及 ruleset 组合共同约束。没有显式角色限制也不代表支持任意混搭。公共发言、投票、获赠能力与原生技能分别判断资格；被动角色没有额外请求不代表免除共同流程。

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

| 序  | 实际函数                        | 物理owner                                                           |
| --- | ------------------------------- | ------------------------------------------------------------------- |
| 1   | `validateInitialIdentityRecord` | `backend/src/recording/verification/initial-identity/validate.ts`   |
| 2   | `validateWildChildRecord`       | `backend/src/recording/verification/wild-child/validate.ts`         |
| 3   | `validateLonelyGirlRecord`      | `backend/src/recording/verification/lonely-girl/validate.ts`        |
| 4   | `validateGhostBrideRecord`      | `backend/src/recording/verification/ghost-bride/validate.ts`        |
| 5   | `validateAnimalDreamRecord`     | `backend/src/recording/verification/animal-dream/validate.ts`       |
| 6   | `validateFragrantPairRecord`    | `backend/src/recording/verification/fragrant-pair-seer/validate.ts` |
| 7   | `validateNobleSecretBodyRecord` | `backend/src/recording/verification/noble-secret-body/validate.ts`  |
| 8   | `validateDemonHunterRecord`     | `backend/src/recording/verification/demon-hunter/validate.ts`       |
| 9   | `validateScholarMentorRecord`   | `backend/src/recording/verification/scholar-mentor/validate.ts`     |
| 10  | `validateMistRavenRecord`       | `backend/src/recording/verification/mist-raven/validate.ts`         |
| 11  | `validateRadiantEclipseRecord`  | `backend/src/recording/verification/radiant-eclipse/validate.ts`    |
| 12  | `validateTimeConsortRecord`     | `backend/src/recording/verification/time-wolf-consort/validate.ts`  |
| 13  | `validateWolfSorcererRecord`    | `backend/src/recording/verification/wolf-sorcerer/validate.ts`      |
| 14  | `validateTricksterRecord`       | `backend/src/recording/verification/trickster/validate.ts`          |
| 15  | `validateMagicianRecord`        | `backend/src/recording/verification/magician/validate.ts`           |
| 16  | `validateOrderPrinceRecord`     | `backend/src/recording/verification/order-prince/validate.ts`       |
| 17  | `validateCupidRecord`           | `backend/src/recording/verification/cupid/validate.ts`              |
| 18  | `validateHybridRecord`          | `backend/src/recording/verification/hybrid/validate.ts`             |
| 19  | `validateDeathHistoryRecord`    | `backend/src/recording/verification/death-history/validate.ts`      |
| 20 | `validateCrowRecord` | `backend/src/recording/verification/crow/validate.ts` |
| 21 | `validateSilenceElderRecord` | `backend/src/recording/verification/silence-elder/validate.ts` |
| 22 | `validateAwakenedClawRecord` | `backend/src/recording/verification/awakened-wolf-king/validate.ts` |
| 23 | `validateWardenRecord` | `backend/src/recording/verification/warden/validate.ts` |

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

[双爪与亲传规则](../rules/awa-awakened-wolf-king-v1.md)只开放原十／十二人牌池及显式女巫自救／十二人梦保护。[完整示例](../examples/awakened-wolf-king/README.md)给出对应公开入口，未实现的觉醒女巫合板另批启用。

`features/awakened-wolf-king/` 持唯一原生／受传库存和亲传夜窗，普通狼受传不改变原身份、不建立赠枪镜像。`engine/hooks/death-action-continuation.ts` 只持一次不透明继续程序；DeathResolution 在首枪真实死亡及全部后代／词徽完成后执行下一爪，仍独占阶段与判胜。付款末端只读真实 ECS 同步核两端原体，不调用可重入的 World 查询或执行未知范围 getter。

`recording/verification/awakened-wolf-king/validate.ts` 只读档案独立重建单位／转出／消费／失效，严格核私有受众、开窗日次、真实夜伤与梦保护、完整后代顺序及精确已知候选的失败CP。它不导入生产库存、死亡写者或恢复许可。两个原板分别以两语各20seed完成受限自然局／严格重放，双爪／亲传的LLM、ACP、mixed完整传输及第二枪missing／late独立反例不外推为其它混搭支持。
