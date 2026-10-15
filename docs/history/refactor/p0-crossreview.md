# P0 文档与 characterization 交叉审查

审查者：refactor_architecture_audit。范围：docs/refactor/{baseline,decisions,characterization}.md 与 backend/tests/architecture/refactor-characterization.test.ts；固定生产起点27a97cb，未改生产源码。

- baseline 正确将原计划仅文档/WIP限定归为作者旧快照，纳入55个已交付角色，隔离分支与不push/付费边界清楚。旧完整验收只复用有字节证明的范围，没有把此前pass总数计入重构候选。
- decisions 唯一存储、动态能力、source与lock、公开reader/严格Tape、因果词汇及只读审查角色符合计划；pending共用架构没有伪装成已实现。
- F01 真实God-only role.camp干预独立于合法camp转化，observation相等而fallback选择不同；测试未把只删byCamp当所有World读取闭合。严格请求不调用fallback，SDK/ACP默认和注入路径均在责任清单，mock/Tape/scripted显式特权。
- F02 真实原context/day/body/deadline失配、read→delivery→preflight→commit拒绝、恢复后成功一次已证实；Noble alias独有失配不撤原请求，shared context内部变更明确属于原envelope。Animal共享alias latch保持原强边界，不混成一个政策。wrong session/turnId只验证普通speak协议路由，无冒充Noble完整运输。
- 时间覆盖描述正确：未来deadline字段修改不是过期测试，60s只是子系统lease寿命；没有等待真实超时、MCP/进程回收或完整Animal lifecycle。这些仍需C18/C19实际边界验证。
- 独立复核命令：backend cwd `bun test --preload ./tests/setup.ts tests/architecture/refactor-characterization.test.ts`，退出0；14 pass/0 fail/117 expect，日志 `/tmp/awa-refactor-p0-architecture-characterization-review.log`。只复核原反例，无新增覆盖，不计入角色完整验收。

非阻断同步项：baseline中的F02问题摘要仍用“可能恢复/characterization确认后”，而同目录characterization已明确证实恢复，C01整合时应改成“已确认恢复，独立C18a修正”，避免下一位读者误解仍待核查。决策文档P1可追加当前sourceHash真实6root/.ts范围与150遗漏的责任说明；详细只读报告已提供。

结论：本范围无阻断问题；允许作为C01/C03候选证据，C02差分执行本身由对应实现记录裁决。
