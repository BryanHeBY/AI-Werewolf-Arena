# 公共能力数据契约中文说明

## 五源范围

实际 Git 基线 `37f56392322fdfa859b0d674f339693e0ca883ff`。五个契约源覆盖能力实例元数据、相关资源结构和玩家知识视图；只改注释：

| 文件 | 有效说明 |
| --- | --- |
| `game-contract/src/night-ability-views.ts` | ID 不授许可；起效／到期日包含边界；公共次数与 payload 库存不同；尝试日与消耗次数分开；七类玩家载荷关联 |
| `game-contract/src/player-state-views.ts` | 摄梦历史不带 live link；查验是揭示知识；女巫关闭日有意不公开；赠枪与学习摘要不授行动 |
| `game-contract/src/role-state-data.ts` | 英文头译中文；学习、激活、模式、关闭日与库存不同；只读类型不深冻结；增益结果不直接执行死亡 |
| `game-contract/src/death-ability-data.ts` | 英文头译中文；gift／transfer 与原生枪不同；授予／武装夜与真实死亡窗口不同 |
| `game-contract/src/inspection.ts` | 英文头译中文；揭示分支与真实底牌／许可不同 |

`night-ability-data.ts` 已有有效中文、来源及深只读边界说明，不为凑数再次修改。许可／政策文件、英文事实 reader、产品词典、公共 enum、类型、导出、包 manifest 与历史原文均不在此批。

## 具体语义来源

说明旁核实际 `abilityStatus`、`recordNightAbilityUse`、`projectNightAbility`、各玩家状态投影、机械／觉醒学习状态与 scope，以及赠枪原读取／资格边界。原公共状态在 `day > expiresAfterDay` 才到期，`maxUses: null` 只关闭公共次数上限，不代表药瓶无限；记 `lastUsedDay` 与增加 `uses` 在运行所有者分开处理，第二药仍按具体政策判断。

玩家数据保留原可写字段。源、状态标签、日期、ID 和库存摘要不是对象／生命／窗口授权；Readonly 只是原类型读取边界，不复制、冻结或新增 schema 验证。内部 `potionTurnClosedDay` 不进入玩家女巫 DTO。查验角色／阵营字段是规则揭示数据，不重新计算真实身份。

## 完整纯注释对照

**28 项精确编辑**包括 3 个英文头翻译和 25 项就地结构／字段说明。五个当前完整源按这28项逆后，与实际 Git before 原文逐字相同。

五个完整 typed 程序 **3,179 节点**、全部 **3,702 个非注释语法叶**和 **10 份 ESNext／CJS 原始输出**全部相同。数据文件主要为类型声明，因此空／相同 JS 不能独立证明类型保真；完整树与全部字面叶同时核对字段、readonly、可选／可空边界、联合、导出及机器值。

实际 tool `7009c8` 退出 0；五个现行职责头与中文首头各 0 诊断，输入为当时 **488 个真实 Git 文档路径**，捕获早于此新 MD。没有类型编译、运行测试、模型或全仓门禁，没有把先前收据当本批执行。

## 限制与交付

代码、类型、字段、machine ID、import／export 全部不改；当前源注释会改变新构建来源指纹，历史 fingerprint、seed、档案或 golden 不重写。本批不代表全中文维护、所有数据契约审计或 P7/P8/P9 全验收。声明与语法检查也不证明所有运行 owner 正确。

源码已冻结，未 Git 提交或写 progress，等待独立语义／注释审查后由 Root 收口。完整 before、精确编辑、当前 SHA 和实际收据见[交付证据](generated/ability-data-chinese-comments-evidence.json)。
