# V3 白皮书索引

## 1. 当前代码详细文档

本目录包含 V3 重构阶段的核心白皮书与实现要求：

1. 后端架构总规范（最高优先级 Source of Truth）：`backend_architecture_whitepaper_v3.md`
2. MVP 版型实现要求（首批落地任务清单）：`v3_mvp_requirements.md`
3. 技术白皮书（通用架构说明）：`technical_whitepaper_v3.md`
4. 玩法白皮书（全角色规则词典）：`gameplay_whitepaper_v3.md`

阅读建议：

1. 先读 `backend_architecture_whitepaper_v3.md`（后端开发最高指导）。
2. 再读 `v3_mvp_requirements.md`（当前迭代的实现清单与验收门槛）。
3. 再读技术白皮书与玩法白皮书（扩展机制与全量规则）。
4. 编码时同步参考：`docs/codebase/*` 的源码镜像文档。

## 2. 未来目标 TODO

- [ ] 基于后端架构白皮书产出 V3 的可执行配置 schema（角色、阶段、钩子、胜负条件）。
- [ ] 为每个技能生成标准化“触发-目标-冲突-结算”模板。
- [ ] 将角色条目映射到后端 ECS 组件设计表。
- [ ] 将 MVP 文档中的 Checklist 映射到实际 issue/任务卡，并持续更新状态。

## 3. 验收标准

- [ ] 后端架构白皮书与 MVP 实现要求已纳入开发入口并被团队统一遵循。
- [ ] 技术与玩法文档覆盖 V3 方案所需全部规则信息。
- [ ] 文档内容可直接驱动后端重构设计，不依赖口头补充。
- [ ] 文档结构与术语在后续迭代中保持一致并可追踪更新。
