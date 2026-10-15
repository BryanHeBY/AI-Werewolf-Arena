# 当前机制交付台账

本文件说明[当前机制台账](generated/current-mechanism-migration.json)中的具体交付范围。它记录某个职责已经有实际 owner 和消费者的部分，不能把 `partial` 理解为整个角色或机制已验收。冻结的[基线矩阵](generated/mechanism-matrix.json)继续保持原 89 行及原字节；当前矩阵保留既有 91 行、910 格和所有历史子项。

本批只登记下列八笔已提交功能，共新增 53 个具体 part。格状态由原 62 `partial`、848 `pending` 变为 109 `partial`、801 `pending`；`complete` 和 `not-applicable` 均仍为 0。这组数量反映职责追踪，不能作为测试覆盖率或完整阶段通过率。

## 本批实际来源

| 提交 | 交付职责 | 当前格内登记 | 维护证据 |
| --- | --- | --- | --- |
| `9a8337a8` | `DeathCommitter` 唯一生命提交／账本，原事实与能力到期前缀，七个具体机制端口 | Animal、Noble、Wild Child 的实际死亡提交步骤；四族的原继承调用与提交后失败前缀，共 7 个 lifecycle part | [死亡提交 owner](death-commit-owner.md) |
| `a483c416` | 同一 `RulePlan`／`BoardParameters` 经经理、Pipeline、bootstrap 与记录入口实际消费 | 默认晚采集与 opaque 现场行为、实际生命周期组合、记录前 plan／参数身份检查，共 3 个 part | [执行规则计划](execution-rule-plan.md) |
| `d4c4ffcf` | `FragrantDeathWavePublication` 拥有原已提交事实、公开根匹配和必要记录 | 双生生命周期步骤和有真实公开事件时的披露，各 1 个 part | [双生波发布](fragrant-wave-publication.md) |
| `95ee2b56` | `game-presentation` 拥有原 33 个展示函数；40 文件／110 个具名绑定已直接迁移 | 28 个具名事件 label 对应格；查验 label、四个结果 label，以及真实 script 注册器消费，共 31 个 text part | [共享展示包](shared-presentation.md) |
| `157e0b0e` | `AnimalDeathWavePreparation` 拥有原过滤、揭示、原因删除和白猫到期准备 | 实际初始／追加消费者的生命周期与到期原因修改，各 1 个 part | [动物波准备](animal-wave-preparation.md) |
| `7d63a4e9` | 机械、觉醒、原生 Witch／Demon Witch 的 owned intent 生产与原读点消费 | 四族各自实际 producer 和原体／因果消费，共 4 个 effect part | [来源 intent 首族](sourced-night-intents.md) |
| `dfd7f6fa` | SDK／ACP 默认回退与生产装配只传脱离冻结的玩家观察 | 默认回退的实际 observation consumer，1 个 part；特权测试接口明确保留 | [生产观察回退](production-observation-fallback.md)、[冻结政策](fallback-observation-policy.md) |
| `1099f2b1` | Recipient／Scholar 内建原毒迁移，真实 direct／reflected 路由参与单目标接受 | Recipient、Scholar 付款前缀，以及机械毒路由消费，共 3 个 effect part | [受赠／学者毒路由](recipient-scholar-poison-routes.md) |

JSON 中每个新增 part 均保存完整提交 ID、实际 owner 路径和已维护文档。原 part、原剩余要求及冻结基线摘要不被改写。新 part 只追加，原 `pending` 格在拥有具体交付时改为 `partial`；没有基于文件存在、旧测试通过或一次示例把整格变为完成。

## 这些 part 的边界

- 共同 `DeathCommitter` 没有被硬塞进名称相似的 `night_death_timing` 模块。现有矩阵只登记确实调用的具体机制步骤；唯一生命账本和公共提交流程的整体 owner 由维护文档说明。关系闭包、遗言、警徽、死亡动作及最终枪过期仍有自己的责任。
- `RulePlan` 固定默认自有贡献的定义和声明预约，当前 actor、库存及 `execute` 仍晚读取。它所消费的四个封盘名称不代表已经统一或迁移胜负算法；checkpoint part 只记录真实 plan／参数身份与原脱离参数编码。
- 动物准备与双生发布分别拥有不同步骤。新端口、类型或调用接线不代表完整 TypedWave／CommitReceipt、各角色权限或所有失败交互已完成。
- 来源 intent 和毒路由保留独立因果 Symbol、原体及版本身份；legacy 输入有明确兼容政策。路由与原集合的 OR 后备并存，本批不能把它描述为已经替代集合或完成完整来源链。
- 每个 presentation part 只登记具名原 formatter 的唯一程序 owner 和真实消费。其余角色提示、私有状态展示、观察可见性、text 旧出口及同输入双语验收仍保留本格待办。
- F01 是单独批准的策略变化，关闭默认生产回退的 World 决策漏洞。显式 mock／规则测试的特权 provider 仍保留，完整 C33／C34 观察和 C36／C44 出口继续执行。

## 本轮未登记的后续来源

`observedCommit` 只是整理时的真实提交上下文，不能解释为截至该提交的所有功能均已计入。已提交的 `d323e2df` DamageEvidence 和 `99fac061` 赠枪生命周期 owner 不在本批八来源范围，下一次台账继续登记；它们不是未提交 WIP。当前 Wave／Receipt 与普通夜 metadata 的开发也没有作为本批 part 写入。

仅中文注释补齐没有记为结构交付，剩余阶段也没有据此关闭。本轮不重跑测试、类型检查、发现或对局；已提交功能的有限验证及独立审查继续由上表维护证据承载。完整同源验收仍按[计划](plan.md)执行。
