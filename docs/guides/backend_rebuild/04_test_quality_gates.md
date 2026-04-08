# backend test and quality gates

## 1. 当前代码详细文档

本文定义 V3 后端重构期间的测试策略与质量闸门，确保“先正确，再优化”。

测试分层：

1. 单元测试（domain/gateway）
2. 集成测试（engine + event registry）
3. 场景回放测试（6 人局/12 人局）
4. 联调冒烟（transport + frontend）

质量闸门（必须通过）：

1. G1 类型闸门：TypeScript 编译无错误。
2. G2 规则闸门：关键规则用例通过（守卫、女巫、白痴、猎人、自爆）。
3. G3 流程闸门：完整夜晚-白天-投票循环稳定运行。
4. G4 协议闸门：后端广播字段与前端消费字段一致。
5. G5 文档闸门：变更模块的 `docs/codebase` 文档已同步更新。

当前状态（2026-04-08）：

1. G1 通过：`cd backend && npm run build`
2. G2 通过：`backend/tests/v3/*` 全通过
3. G3 通过：`cd backend && npm run run:v3`
4. G4 通过：`/api/status`、`/api/start-game`、`/api/session` 冒烟成功
5. G5 通过：`docs/codebase` 已按当前目录重建

MVP 必测清单：

1. `guard(target_id)` 连续同守拦截。
2. `use_potion(..., "heal")` 自救拦截（12 人局）。
3. 同夜双药使用拦截。
4. `shoot(target_id)` 触发条件正确（毒死闷枪）。
5. `self_destruct(reason)` 中断当前白天并跳夜。
6. `DamageResolutionSystem` 同守同救与毒药结算正确。

测试执行策略：

1. 每完成一个任务分组，立即补对应测试。
2. 每个阶段合并前执行最小回归。
3. 每日一次完整 MVP 回归。

## 2. 未来目标 TODO

- [x] 为每个闸门补充失败时的排查手册。
- [x] 为每个必测清单项增加日志断言模板。
- [x] 建立“慢测”与“快测”分离执行策略。

## 3. 验收标准

- [x] 所有代码合并前必须满足 G1~G5。
- [x] MVP 必测清单项有自动化覆盖且可重复运行。
- [x] 测试失败能快速定位到模块与规则条款。
