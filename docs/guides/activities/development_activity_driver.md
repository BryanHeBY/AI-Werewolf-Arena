# development activity driver

## 1. 当前代码详细文档

本文件定义 V3 后续开发活动的执行驱动，适用于后端优先重构阶段。

活动目标：

1. 按 `docs/specs/backend_architecture_whitepaper_v3.md` 作为后端唯一技术规范推进实现。
2. 按 `docs/specs/v3_mvp_requirements.md` 作为当前里程碑验收清单推进交付。
3. 所有实现均先更新 `docs/codebase/*` 再改代码，保持“文档先行”。
4. 后端重构期间以 `docs/guides/backend_rebuild/*` 作为任务分解与推进主看板。

标准开发节奏（每个任务都执行）：

1. 需求对齐：在白皮书/MVP 中定位条款与边界。
2. 影响面分析：在 `docs/codebase` 确认涉及文件、导出项、依赖项。
3. 设计落文档：先更新相关文档中的 TODO 与验收标准。
4. 小步实现：按模块提交（core / ecs / agent / server 分层推进）。
5. 回归验证：补充或更新测试，再进行最小回归。
6. 文档回写：同步更新变更文件的 codebase 文档与 guides 状态。

建议开发顺序（V3 后端）：

1. ECS 数据层（Role/Camp/Alive/VotingRight/StatusMarks）。
2. PhaseManager 串行流程（day/night/vote + hooks）。
3. Tool 网关（校验、错误反弹、重试）。
4. 事件总线拦截（白痴、猎人、自爆中断）。
5. 服务层协议对齐（socket/broadcast）。

## 2. 未来目标 TODO

- [ ] 将每个 V3 条款映射到具体代码文件（一条条款至少一个责任文件）。
- [ ] 在 `docs/guides/drivers/backend_driver.md` 增加“本周开发焦点”滚动区块。
- [ ] 增加“重构迁移状态表”（未开始/开发中/可联调/可验收）。
- [ ] 将开发任务拆分为可独立提交的最小单元（避免大提交难回归）。

## 3. 验收标准

- [ ] 每个开发任务都能追溯到 specs 条款与 codebase 文件节点。
- [ ] 每个提交都包含代码与文档的同步更新，不出现“只改代码不改文档”。
- [ ] 核心模块改动均可通过最小回归用例验证。
- [ ] 开发节奏可持续推进，不依赖口头约定补全上下文。
