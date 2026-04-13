# backend cutover and rollback

## 1. 当前代码详细文档

本文定义 V3 后端重构完成后的切换策略，避免“一次性替换”导致高风险事故。

切换策略（当前已执行）：

1. 先完成 V3 独立验证（`build:v3`、`test:v3`、`run:v3`）。
2. 接入 V3 服务入口与会话管理后，执行 API 冒烟（`/api/status`、`/api/start-game`、`/api/session`）。
3. 验证通过后移除 V2 代码与旧测试，切换为 V3 单栈。

切换前检查清单：

1. MVP 关键规则回归全部通过。
2. 协议字段对齐验证通过。
3. 关键日志具备可追踪性（阶段、动作、结算、胜负判定）。
4. 回滚脚本或开关已验证可用。

回滚策略：

1. 触发条件：规则错误、流程中断、严重协议不兼容。
2. 回滚动作：回退到 V2 备份提交（`198bb0c` 之前的 commit）或临时分支 tag。
3. 数据处理：保留失败场景日志用于复盘，不做静默丢弃。
4. 修复流程：定位 -> 热修 -> 本地回归 -> 再次发布。

## 2. 开发任务清单

- [x] `T01` 在 `backend/src/config/index.ts` 增加 `V3_ENGINE_ENABLED` 开关，并在 `backend/src/server/index.ts` 接入双入口切换能力。
- [x] `T02` 在 `backend/src/server/view_mapper.ts` 增加发布观测字段（phase、alive_count、pending_marks、last_action_id）。
- [x] `T03` 新增 `backend/tests/v3/cutover_rollback.test.ts`，验证开关切换与失败回退路径。

## 3. 验收标准（任务映射）

- [x] `A01`（对应: `T01`） 通过环境变量可在不改代码的情况下切换 V3 引擎启停。
- [x] `A02`（对应: `T02`） `/api/session` 返回观测字段并可用于线上问题定位。
- [x] `A03`（对应: `T03`） 回滚测试可自动验证“启用 -> 失败 -> 回退 -> 恢复”全链路。
