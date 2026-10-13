# 项目文档

已实现行为以代码、测试和根目录 [README](../README.md) 为准。目标文档用于约束后续实施与验收，不能将其中的计划功能视为已上线。

当前产品链路为：LLM/ACP 对局 → `record/` 对局记录 → `.replay.json` 导出文件 → React 离线复盘播放器。在线观战、多租户在线服务隔离和外部服务 API 不在此次范围；玩家信息权限、并行对局隔离及离线复盘共享契约属于既有链路与扩充验收。

## 当前规则与架构

- [现行规则卡与来源](rules/README.md)
- [完整架构重构计划](refactor/plan.md)
- [架构重构进度与证据](refactor/progress.md)

## 玩法扩充历史与验收

- [完整目标、机制、中英双语要求与阶段路线](expansion/roadmap.md)
- [64 项可配置角色目录与规则来源](expansion/roles.md)
- [测试、子代理交叉审查与 commit 拆分指南](expansion/delivery.md)
- [本轮 P0 文档交叉审查记录](expansion/review-2026-10-07.md)
- [实施进度与阶段证据](expansion/progress.md)
- [P6 狼美人规则、配置、生命周期与验收范围](expansion/wolf-beauty.md)
- [P6 熊取样、公告、配置与验收范围](expansion/bear.md)
- [P6 隐狼信息、接刀、生命绑定与验收范围](expansion/hidden-wolf.md)

P0 文档与首笔 commit 已完成。用户于 2026-10-07 授权开始完整实现，后续按阶段验收、交叉审查和功能提交持续推进。
