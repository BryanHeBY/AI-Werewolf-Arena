# 角色三贡献与动物状态的交付登记

本批只把已提交 `1313149e` 与 `bccbc17c` 的实际职责追加到[当前台账](generated/current-mechanism-migration.json)。47 个真实 profile 的 text／oldExports 各一项，Catalog 两格及 Animal state／checkpoint 两格，共 98 个具体 part。

状态从 109 partial／801 pending 更新为 181 partial／729 pending；91 行、910 格保持，complete 与 not-applicable 仍为 0。原 part 和剩余要求逐项保留，冻结基线原字节不改。

三贡献登记依据完整55角色、47声明和84调用方的实际迁移与独立审查；内建旧展示API退出是明确范围，不等于所有机制出口清零。动物三族已经有真实 state／codec 消费，但跨生命周期、失败归档和最终矩阵继续。证据分别见[三贡献](role-contributions-and-components.md)与[动物状态](animal-state-slot.md)。

较早后继功能仍须下一批补登记；F01 当前权限修复未在本批两来源中登记；类型旧入口开发也不作为本批已交付 part。台账数量不是测试覆盖率，不据其宣布阶段或全目标完成。

审查证据补核：三贡献提交的临时 AST 遍历脚本曾漏节点，完整重查已发现并修复两处测试 fixture 从自定义贡献错误换成默认贡献的问题。对应行为恢复和审查证据另行提交；本台账仅登记实际 owner／接口迁移，所有格仍保留最终验收要求，不把旧程序证明视为已经完整通过。
