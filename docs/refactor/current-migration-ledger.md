# 当前机制迁移台账

[当前台账](generated/current-mechanism-migration.json) 与 [冻结基线矩阵](generated/mechanism-matrix.json) 分开。基线的文件、消费者、行名及 static-presence 证据属于 Git `27a97cb`，不能用当前路径覆盖或反推架构已验收。当前台账保留基线摘要，以每个具体交付子项登记实际 owner、commit 和维护文档。

每格状态为 pending、partial、complete 或有依据的 not-applicable。一个访问器、一条消费命令、一个共享查询或普通夜间 unit 只完成相应子项；schema/编码、所有消费者、原体失效、生命周期、独立审计或旧出口仍未闭合时保持 partial。不能把这些试点加总后宣布整个阶段完成。

首份当前台账有 89 个基线行与 1 个 current-only 查询 owner 行，共 900 格：42 格 partial、858 格 pending，零 complete、零 not-applicable。这是对已提交切片的保守登记，不是玩法能力缺失统计。原 55 个角色的执行支持与迁移架构是否闭合分别判断。

更新规则：先检查实际源码及全部相关 consumers，再登记对应 commit 和证据；新增承担独立职责的机制必须加入当前台账。验收一格时，列出的剩余要求必须逐项有相应范围的实现、测试和独立审查，不能靠静态模块存在、一个局部 case、历史 golden 或 absence search 清空。完整完成还需原计划所有阶段与最终同源门禁、零桥接/债务；本台账不会替代这些要求。

首份交付子项只覆盖已提交 C17–C24 的状态、请求、查询和生命周期边界。C08 facts、C09 support 及其他阶段的具体迁移仍须逐项纳入；当前未登记部分保持 pending，不宣称台账已经包含所有交付。

记录中的 candidate SHA、旧路径和测试结果是对应历史切片的输入身份。后续迁移可以改变当前源码，但必须新增真实证据，而不能悄悄将旧摘要改为当前摘要或将原失败日志改成成功。未提交候选不登记交付。

Git `4e39548` 检查点新增 Witch 普通 payload 写权、Seer/Guard 既有目标政策入口、Noble 实际 night handoff 四个已提交子项。该检查点为 43 格 partial、857 格 pending，仍零 complete/N/A；首次台账的统计是历史输入，不改为当前数字。Noble 的 expiry/damage/death/exile、完整原体失效等其他边界仍待闭合。

Git `588e7554` 检查点补入四类普通选择/反馈历史写入与 Radiant acquired night unit，共新增五个部分。该检查点 44 格 partial、856 格 pending，仍零 complete/N/A。状态的 schema、编码、剩余写权和 Radiant 的租借/抑制/已付效果等其他边界继续待验收。

Git `cb2957ac` 检查点登记配置行的唯一 World 参数 owner：真实引擎、Agent、模拟与复盘共享只读规则数据，独立 DTO 不授予写权。该项只让配置 state 格从 pending 进入 partial；完整 RulePlan、其他配置边界与最终门禁仍待完成。该检查点共 45 格 partial、855 格 pending，零 complete/N/A；冻结基线矩阵字节未变。

Git `709dc222`、`73943cac`、`5a5d5b8d` 分别登记迷雾、时妃、师徒的 cleanup-transfer 与 manager 终结入口。三格 lifecycle 由 pending 进入 partial；开夜、已付资源、伤害及其他完整生命周期要求未被这些局部交付关闭。该检查点 48 格 partial、852 格 pending，零 complete/N/A；90 行、900 格和冻结基线保持。

Git `f6c48778` 为既有 Seer state 格追加真实深只读入口子项，原封印写者、通用可写能力句柄和完整 codec 继续待完成。Git `9695d888` 将魔术师、狼巫、捣蛋鬼的原共享交接格登记为 partial；三族开夜、库存、映射和实际终结规则未改变。当前 51 格 partial、849 格 pending，仍零 complete/N/A；不能将局部子项视为整个 P3/P4 或完整机制验收。

Git `03cf07e8` 登记原角色容器的独立读取／初始化契约 owner 为第二个 current-only 跟踪行；这不是新增玩法或第二份状态。该行仅 state 为 partial，能力元数据／payload、全部 schema／codec、扩展编码和最终 opaque 表面仍待闭合，其余列继续 pending。当前 91 行、910 格，52 partial、858 pending，零 complete/N/A；89 行冻结基线保持。
