# release report

## 1. 发布概览

- 发布时间：2026-04-09
- 发布分支 / commit：`feature/v3-backend-new`（工作区验证）
- 目标范围：docs/guides 无人值守循环收口 + V3 依赖方向修复
- 执行人：Codex

## 2. 变更摘要

1. 后端核心变更：修复 `backend/src/v3/llm_action_provider.ts` 的分层依赖违规（移除 `v3 -> infra` 直连）。
2. 测试新增/修改：`backend/tests/v3/minimax_live_connectivity.test.ts` 增加配置来源与掩码状态日志（不输出密钥）。
3. 配置与发布链路变更：保持 `release:check`、`lint:deps`、`test:quick/test:full` 为发布前主检查口。

变更文件列表（本次范围）：

- `backend/src/v3/llm_action_provider.ts`
- `backend/tests/v3/minimax_live_connectivity.test.ts`
- `docs/guides/activities/development_activity_driver.md`
- `docs/guides/activities/testing_activity_driver.md`
- `docs/guides/activities/review_release_activity_driver.md`
- `docs/guides/activities/readme.md`
- `docs/guides/drivers/backend_driver.md`
- `docs/guides/drivers/frontend_driver.md`
- `docs/guides/drivers/project_driver.md`
- `docs/guides/drivers/readme.md`
- `docs/guides/readme.md`
- `docs/guides/release_reports/2026-04-09_unattended_docs_cycle.md`

## 3. 检查结果（含时间戳）

- `2026-04-09T03:59:18+08:00` `cd backend && npm run build:v3`：通过
- `2026-04-09T03:59:19+08:00` `cd backend && npm run test:quick`：通过
- `2026-04-09T03:59:21+08:00` `cd backend && npm run test:full`：通过
- `2026-04-09T03:59:23+08:00` `cd backend && npm run smoke:v3`：通过（日志含 `game_over + winner + reason`）
- `2026-04-09T03:59:24+08:00` `cd backend && npm run lint:deps`：通过
- `2026-04-09T03:59:24+08:00` `cd backend && npm run release:check`：通过
- `2026-04-09T03:59:28+08:00` `cd backend && npm test -- --runInBand tests/v3/cutover_rollback.test.ts`：通过
- `2026-04-09T03:59:29+08:00` `cd backend && RUN_LIVE_LLM_TEST=1 npm test -- --runInBand tests/v3/minimax_live_connectivity.test.ts`：通过

## 4. 异常与处理

1. 异常描述：`npm run lint:deps` 曾报 `src/v3/llm_action_provider.ts` 违规引用 `../infra/llm/openai_client`。
2. 根因定位：`src/v3` 层直接依赖 `infra`，违反分层约束。
3. 修复动作（代码/测试）：将 `llm_action_provider.ts` 改为本地协议类型 + `ChatLike` 抽象；回归执行 `lint:deps`、`build:v3`、`llm_action_provider.test.ts`。
4. 是否回滚：否。
5. 回写任务 ID（`docs/guides/backend_rebuild/03_task_backlog.md`）：无（本轮检查全部通过，未触发发布阻断）。

## 5. 验收结论

- 是否满足本阶段验收标准：满足。
- 遗留风险：前端 `vue-tsc` 与当前 Node 版本存在工具兼容问题（已在开发活动文档新增专项 TODO `T24/A25` 跟踪）。
- 下一步任务：继续按无人值守准则逐条清空 `docs/guides` 剩余 TODO。
