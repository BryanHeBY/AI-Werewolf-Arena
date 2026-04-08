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
5. G5 文档闸门：变更模块的源码中文注释与 `docs/guides` 任务状态已同步更新。

当前状态（2026-04-08）：

1. G1 通过：`cd backend && npm run build`
2. G2 通过：`backend/tests/v3/*` 全通过
3. G3 通过：`cd backend && npm run run:v3`
4. G4 通过：`/api/status`、`/api/start-game`、`/api/session` 冒烟成功
5. G5 通过：关键源码已补充中文注释且任务文档已同步

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

## 2. 开发任务清单

- [x] `T01` 新增 `backend/tests/v3/night_wolf_tactical_loop.test.ts`，覆盖狼队发言顺序、投票顺序、落刀目标一致性。
- [x] `T02` 新增 `backend/tests/v3/day_interrupt_hooks.test.ts`，覆盖 4 类中断窗口与自爆跳夜。
- [x] `T03` 在 `backend/package.json` 增加 `test:quick` 与 `test:full`，将关键回归与全量回归分离执行。

## 3. 验收标准（任务映射）

- [x] `A01`（对应: `T01`） 新增夜间战术环测试在本地连续运行稳定通过（至少 5 次）。
- [x] `A02`（对应: `T02`） 新增白天中断测试可覆盖“打断发言队列并跳夜”的关键链路。
- [x] `A03`（对应: `T03`） `npm run test:quick` 30 秒内完成，`npm run test:full` 覆盖全部 V3 测试集。
