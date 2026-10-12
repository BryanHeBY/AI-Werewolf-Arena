# 当前机制迁移台账

[当前台账](generated/current-mechanism-migration.json) 与 [冻结基线矩阵](generated/mechanism-matrix.json) 分开。基线的文件、消费者、行名及 static-presence 证据属于 Git `27a97cb`，不能用当前路径覆盖或反推架构已验收。当前台账保留基线摘要，以每个具体交付子项登记实际 owner、commit 和维护文档。

每格状态为 pending、partial、complete 或有依据的 not-applicable。一个访问器、一条消费命令、一个共享查询或普通夜间 unit 只完成相应子项；schema/编码、所有消费者、原体失效、生命周期、独立审计或旧出口仍未闭合时保持 partial。不能把这些试点加总后宣布整个阶段完成。

首份当前台账有 89 个基线行与 1 个 current-only 查询 owner 行，共 900 格：42 格 partial、858 格 pending，零 complete、零 not-applicable。这是对已提交切片的保守登记，不是玩法能力缺失统计。原 55 个角色的执行支持与迁移架构是否闭合分别判断。

更新规则：先检查实际源码及全部相关 consumers，再登记对应 commit 和证据；新增承担独立职责的机制必须加入当前台账。验收一格时，列出的剩余要求必须逐项有相应范围的实现、测试和独立审查，不能靠静态模块存在、一个局部 case、历史 golden 或 absence search 清空。完整完成还需原计划所有阶段与最终同源门禁、零桥接/债务；本台账不会替代这些要求。

首份交付子项只覆盖已提交 C17–C24 的状态、请求、查询和生命周期边界。C08 facts、C09 support 及其他阶段的具体迁移仍须逐项纳入；当前未登记部分保持 pending，不宣称台账已经包含所有交付。

记录中的 candidate SHA、旧路径和测试结果是对应历史切片的输入身份。后续迁移可以改变当前源码，但必须新增真实证据，而不能悄悄将旧摘要改为当前摘要或将原失败日志改成成功。未提交候选不登记交付。

Git `4e39548` 检查点新增 Witch 普通 payload 写权、Seer/Guard 既有目标政策入口、Noble 实际 night handoff 四个已提交子项。当前 43 格 partial、857 格 pending，仍零 complete/N/A；首次台账的统计是历史输入，不改为当前数字。Noble 的 expiry/damage/death/exile、完整原体失效等其他边界仍待闭合。
